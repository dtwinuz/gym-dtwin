import { exerciseById } from '../catalogue'
import { bestE1rm, detectRecords, exerciseHistory, isoDate, parseIso, setsDone, sortByStart, topSet, workoutVolume } from '../core/history'
import { BAR_DEFAULTS, defaultPlates, solvePlates, type PlateLoad } from '../core/plates'
import { modeOf, nextPrescription, policyOf, readSession, type Prescription } from '../core/progression'
import type { ActiveSession, Drop, Entry, ISODate, Mode, Ms, Profile, RestTimer, Routine, SetRow, Settings, Slot, Workout } from '../core/types'
import { defaultIncrement, floorTo, roundLift } from '../core/units'
import { warmupRamp } from '../core/warmup'
import { newId } from './plan'
import { upsertItem } from './profile'
import { newSlot, normalizeSupersets, sanitizeSlot } from './slots'

export type Side = 'L' | 'R'

/** Past the last tick by this much, a session counts as forgotten. */
const IDLE_MS = 3 * 3_600_000
const WARMUP_REST_CAP = 60
const NOON_MS = 12 * 3_600_000

export const RIR_LEVELS = [0, 1, 2, 3, 4, 5]
export const RPE_LEVELS = [10, 9, 8, 7, 6, 5]

/** Comma or dot decimals; anything unusable is undefined. */
export function parseNum(text: string, integer = false): number | undefined {
  const t = text.trim().replace(',', '.')
  if (!t) return undefined
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return undefined
  return integer ? Math.round(n) : n
}

/** The `?routine=a,b&date=YYYY-MM-DD` entry contract of the workout route. */
export function parseEntry(query: URLSearchParams, p: Profile, today: ISODate): { ids: string[]; date: ISODate } {
  const ids = (query.get('routine') ?? '').split(',').filter(id => p.routines.some(r => r.id === id))
  const asked = query.get('date') ?? ''
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today && !Number.isNaN(parseIso(asked).getTime())
  return { ids, date: valid ? asked : today }
}

export const sameEntry = (s: ActiveSession, ids: string[], date: ISODate) =>
  s.date === date && s.routineIds.length === ids.length && s.routineIds.every((id, i) => id === ids[i])

export const isPast = (s: Pick<ActiveSession, 'date' | 'start'>) => s.date < isoDate(new Date(s.start))
const pastStart = (date: ISODate) => parseIso(date).getTime() + NOON_MS

export const entryMode = (e: Entry): Mode => (e.target ? modeOf(e.target) : e.sets.some(s => s.min != null) ? 'cardio' : e.sets.some(s => s.sec != null) ? 'time' : 'reps')

const routineOf = (p: Profile, id?: string): Routine | undefined => p.routines.find(r => r.id === id)
const incOf = (p: Profile, slot: Slot) => slot.inc ?? defaultIncrement(p.settings.unit, exerciseById(slot.exId)?.p[0])

export function barWeightOf(p: Profile, exId: string): number {
  const own = p.barWeights[exId]
  if (own != null) return own
  const e = exerciseById(exId)
  if (!e) return 0
  const { unit } = p.settings
  if (/smith/i.test(e.n)) return BAR_DEFAULTS.smith[unit]
  if (/trap bar/i.test(e.n)) return BAR_DEFAULTS['trap bar'][unit]
  return BAR_DEFAULTS[e.eq]?.[unit] ?? 0
}

/** Plates for one set; null when the exercise has no bar or the weight is under it. */
export function plateLine(p: Profile, exId: string, w: number | undefined): PlateLoad | null {
  const bar = barWeightOf(p, exId)
  if (!bar || !w || w < bar) return null
  return solvePlates(w, bar, p.plates[p.settings.unit] ?? defaultPlates(p.settings.unit))
}

/** The session the lifter measures against: the latest, or the one with the best estimated 1RM. */
export function refEntry(history: Entry[], logRef: Settings['logRef'], formula: Settings['oneRmFormula']): Entry | undefined {
  const logged = history.filter(e => e.sets.some(s => s.done && !s.warmup))
  if (logRef === 'last') return logged.at(-1)
  let best: Entry | undefined
  let score = -1
  for (const e of logged) {
    const top = topSet(e)
    const v = bestE1rm([e], formula) || top?.w || top?.sec || top?.min || 0
    if (v >= score) {
      best = e
      score = v
    }
  }
  return best
}

const sideRow = (r: number | undefined, w: number | undefined) => ({ w, r, done: false })

/** Reps of a per-side set are the total, as in progression: L + R. */
function withSides(row: SetRow): SetRow {
  const half = row.r == null ? undefined : Math.ceil(row.r / 2)
  return syncSides({ ...row, sides: { L: sideRow(half, row.w), R: sideRow(half, row.w) } })
}

function syncSides(row: SetRow): SetRow {
  if (!row.sides) return row
  const { L, R } = row.sides
  return { ...row, w: Math.max(L.w ?? 0, R.w ?? 0), r: (L.r ?? 0) + (R.r ?? 0), done: L.done && R.done }
}

function buildSets(p: Profile, slot: Slot, rx: Prescription, weight: number, ref: Entry | undefined): SetRow[] {
  const { settings } = p
  const fromLast = settings.startFrom === 'last' && ref ? ref.sets.filter(s => s.done && !s.warmup) : []
  const pick = (i: number) => fromLast[i] ?? fromLast.at(-1)
  const mode = modeOf(slot)

  if (mode === 'cardio') {
    const r = pick(0)
    return [{ min: r?.min ?? slot.min ?? 10, speed: r?.speed ?? slot.speed, incline: r?.incline ?? slot.incline, done: false }]
  }
  if (mode === 'time') {
    return Array.from({ length: rx.sets }, (_, i) => ({ w: pick(i)?.w ?? weight, sec: pick(i)?.sec ?? rx.sec ?? slot.sec ?? 30, done: false }))
  }

  const work: SetRow[] = slot.pyramid?.length
    ? slot.pyramid.map((x, i) => ({ w: pick(i)?.w ?? weight, r: x === 'max' ? undefined : x, done: false }))
    : Array.from({ length: rx.sets }, (_, i) => ({ w: pick(i)?.w ?? weight, r: pick(i)?.r ?? rx.reps, done: false }))

  const last = work[work.length - 1]
  if (slot.intensifier === 'dropset' && last?.w) {
    const left = 1 - (slot.dropPct ?? 20) / 100
    last.drops = Array.from({ length: slot.dropCount ?? 2 }, (_, k): Drop => ({ w: roundLift((last.w ?? 0) * left ** (k + 1), settings.unit), r: last.r ?? 0 }))
  }
  if (slot.intensifier === 'restpause' && last?.r) work.push({ w: last.w, r: Math.ceil(last.r / 2), rp: true, done: false })

  const step = settings.unit === 'kg' ? 2.5 : 5
  const top = work[0]?.w ?? 0
  const ramp: SetRow[] = warmupRamp(top, slot.warmups ?? 0, step, barWeightOf(p, slot.exId)).map(x => ({ w: x.w, r: x.r, warmup: true, done: false }))
  const rows = [...ramp, ...work]
  return slot.side ? rows.map(withSides) : rows
}

/** One exercise of a session: the set table prefilled from the plan or the last sessions. */
export function buildEntry(p: Profile, slot: Slot, routine: Routine | undefined, before: Ms): Entry {
  const { settings } = p
  const history = exerciseHistory(p.workouts, slot.exId, before)
  const rx = nextPrescription({ slot, history, policy: policyOf(slot, routine?.prog), inc: incOf(p, slot) })
  const weight = rx.weight || p.exWeights[slot.exId]?.w || 0
  const ref = refEntry(history, settings.logRef, settings.oneRmFormula)
  const entry: Entry = { exId: slot.exId, sets: buildSets(p, slot, rx, weight, ref), target: slot, rx: { sets: rx.sets, reps: rx.reps, weight, sec: rx.sec, why: rx.why } }
  if (routine) entry.routineId = routine.id
  if (slot.sg) entry.sg = slot.sg
  return entry
}

function normalizeEntries(entries: Entry[]): Entry[] {
  const slots = normalizeSupersets(entries.map(e => ({ exId: e.exId, sets: 0, reps: 0, weight: 0, sg: e.sg })))
  return entries.map((e, i) => {
    const next = { ...e }
    if (slots[i].sg) next.sg = slots[i].sg
    else delete next.sg
    return next
  })
}

export function startSession(p: Profile, routineIds: string[], date: ISODate, name: string, now: Ms = Date.now(), makeId: () => string = newId): ActiveSession {
  const routines = routineIds.map(id => routineOf(p, id)).filter((r): r is Routine => !!r)
  const before = date < isoDate(new Date(now)) ? pastStart(date) : now
  return {
    id: makeId(),
    date,
    start: now,
    routineIds: routines.map(r => r.id),
    name: routines.map(r => r.name).join(' + ') || name,
    entries: normalizeEntries(routines.flatMap(r => r.ex.map(slot => buildEntry(p, slot, r, before)))),
    cur: 0,
  }
}

/* rest timer: an absolute end time plus what a pause froze */

export const restStart = (total: number, now: Ms): RestTimer => ({ endsAt: now + total * 1000, total })

export const restLeft = (r: RestTimer, now: Ms) => (r.pausedLeft != null ? r.pausedLeft : Math.max(0, (r.endsAt - now) / 1000))

export const restExpired = (r: RestTimer, now: Ms) => r.pausedLeft == null && now >= r.endsAt

export const restPause = (r: RestTimer, now: Ms): RestTimer => (r.pausedLeft != null ? r : { ...r, pausedLeft: restLeft(r, now) })

export function restResume(r: RestTimer, now: Ms): RestTimer {
  if (r.pausedLeft == null) return r
  return { endsAt: now + r.pausedLeft * 1000, total: r.total }
}

/** Add or take seconds; undefined when nothing is left. */
export function restShift(r: RestTimer, delta: number, now: Ms): RestTimer | undefined {
  const left = restLeft(r, now) + delta
  if (left <= 0) return undefined
  const total = Math.max(r.total, left)
  return r.pausedLeft != null ? { ...r, pausedLeft: left, total } : { endsAt: now + left * 1000, total }
}

const hasPending = (e: Entry) => e.sets.some(s => !s.done)

function supersetGroup(entries: Entry[], ei: number): number[] {
  const sg = entries[ei]?.sg
  if (!sg) return [ei]
  let a = ei
  let b = ei
  while (entries[a - 1]?.sg === sg) a--
  while (entries[b + 1]?.sg === sg) b++
  return Array.from({ length: b - a + 1 }, (_, i) => a + i)
}

/** Seconds of rest after a set; a superset rests only after its last member. */
export function restAfter(s: ActiveSession, ei: number, si: number, settings: Pick<Settings, 'restSec' | 'restPauseSec' | 'warmupRestSec'>): number {
  const e = s.entries[ei]
  const slot = e.target
  if (slot?.restOff) return 0
  if (supersetGroup(s.entries, ei).some(i => i > ei && hasPending(s.entries[i]))) return 0
  const base = slot?.restSec ?? settings.restSec
  if (e.sets.slice(si + 1).find(x => !x.done)?.rp) return settings.restPauseSec
  if (e.sets[si]?.warmup) return settings.warmupRestSec ?? Math.min(WARMUP_REST_CAP, base)
  return base
}

function nextCur(s: ActiveSession, ei: number): number {
  const group = supersetGroup(s.entries, ei)
  if (group.length > 1) {
    const at = group.indexOf(ei)
    for (let k = 1; k <= group.length; k++) {
      const i = group[(at + k) % group.length]
      if (hasPending(s.entries[i])) return i
    }
  } else if (hasPending(s.entries[ei])) return ei
  const n = s.entries.length
  for (let k = 1; k <= n; k++) {
    const i = (ei + k) % n
    if (hasPending(s.entries[i])) return i
  }
  return ei
}

/** The set Space would tick: from the current exercise on, wrapping around. */
export function nextPending(s: ActiveSession): { ei: number; si: number; side?: Side } | null {
  const n = s.entries.length
  for (let k = 0; k < n; k++) {
    const ei = (s.cur + k) % n
    const si = s.entries[ei].sets.findIndex(x => !x.done)
    if (si < 0) continue
    const row = s.entries[ei].sets[si]
    return { ei, si, side: row.sides ? (row.sides.L.done ? 'R' : 'L') : undefined }
  }
  return null
}

const mapRow = (s: ActiveSession, ei: number, si: number, fn: (r: SetRow) => SetRow): ActiveSession => ({
  ...s,
  entries: s.entries.map((e, i) => (i === ei ? { ...e, sets: e.sets.map((r, j) => (j === si ? fn(r) : r)) } : e)),
})

export const patchSet = (s: ActiveSession, ei: number, si: number, patch: Partial<SetRow>) => mapRow(s, ei, si, r => ({ ...r, ...patch }))

export const patchSide = (s: ActiveSession, ei: number, si: number, side: Side, patch: { w?: number; r?: number }) =>
  mapRow(s, ei, si, r => (r.sides ? syncSides({ ...r, sides: { ...r.sides, [side]: { ...r.sides[side], ...patch } } }) : r))

/** A set without reps (a "max" pyramid step, a cleared field) cannot be ticked yet. */
export function canTick(row: SetRow, mode: Mode, side?: Side): boolean {
  if (row.done) return true
  if (mode === 'time') return (row.sec ?? 0) > 0
  if (mode === 'cardio') return (row.min ?? 0) > 0
  if (row.sides) return side ? (row.sides[side].r ?? 0) > 0 || row.sides[side].done : (row.sides.L.r ?? 0) + (row.sides.R.r ?? 0) > 0
  return (row.r ?? 0) > 0
}

/** Tick or untick a set. A newly finished one starts the rest and moves on. */
export function tickSet(s: ActiveSession, ei: number, si: number, settings: Settings, now: Ms = Date.now(), side?: Side): ActiveSession {
  const row = s.entries[ei]?.sets[si]
  if (!row) return s
  const toggled = (r: SetRow): SetRow => {
    if (!r.sides) return { ...r, done: !r.done }
    if (side) return syncSides({ ...r, sides: { ...r.sides, [side]: { ...r.sides[side], done: !r.sides[side].done } } })
    const done = !r.done
    return syncSides({ ...r, sides: { L: { ...r.sides.L, done }, R: { ...r.sides.R, done } } })
  }
  const out: ActiveSession = { ...mapRow(s, ei, si, toggled), lastAt: now }
  if (out.work?.ei === ei && out.work.si === si) delete out.work
  if (row.done || !out.entries[ei].sets[si].done) return out
  const sec = isPast(s) ? 0 : restAfter(out, ei, si, settings)
  const next: ActiveSession = { ...out, cur: nextCur(out, ei) }
  if (sec > 0) next.rest = restStart(sec, now)
  else delete next.rest
  return next
}

export function tickNext(s: ActiveSession, settings: Settings, now: Ms = Date.now()): ActiveSession {
  const at = nextPending(s)
  return at ? tickSet(s, at.ei, at.si, settings, now, at.side) : s
}

export function startWork(s: ActiveSession, ei: number, si: number, now: Ms = Date.now()): ActiveSession {
  const sec = s.entries[ei]?.sets[si]?.sec ?? 0
  if (sec <= 0) return s
  const { rest: _rest, ...rest } = s
  return { ...rest, work: { ei, si, endsAt: now + sec * 1000 } }
}

export function stopWork(s: ActiveSession): ActiveSession {
  const { work: _work, ...rest } = s
  return rest
}

/** Complete the timed set whose countdown has run out. */
export function settleWork(s: ActiveSession, settings: Settings, now: Ms = Date.now()): ActiveSession {
  if (!s.work || now < s.work.endsAt) return s
  const { ei, si } = s.work
  const row = s.entries[ei]?.sets[si]
  const clear = stopWork(s)
  return row && !row.done ? tickSet(clear, ei, si, settings, now) : clear
}

export function addSet(s: ActiveSession, ei: number): ActiveSession {
  const e = s.entries[ei]
  if (!e) return s
  const works = e.sets.filter(x => !x.warmup && !x.rp)
  const base = works.at(-1) ?? e.sets.at(-1)
  const row: SetRow = base
    ? { w: base.w, r: base.r, sec: base.sec, min: base.min, speed: base.speed, incline: base.incline, done: false }
    : { w: e.rx?.weight, r: e.rx?.reps, sec: e.rx?.sec, done: false }
  const fresh = e.target?.side && modeOf(e.target) === 'reps' ? withSides(row) : row
  return { ...s, entries: s.entries.map((x, i) => (i === ei ? { ...x, sets: [...x.sets, fresh] } : x)) }
}

export function removeSet(s: ActiveSession, ei: number, si: number): ActiveSession {
  const { work: _work, ...rest } = s
  return { ...rest, entries: s.entries.map((e, i) => (i === ei ? { ...e, sets: e.sets.filter((_, j) => j !== si) } : e)) }
}

export function addDrop(s: ActiveSession, ei: number, si: number, unit: Settings['unit']): ActiveSession {
  return mapRow(s, ei, si, r => {
    const drops = r.drops ?? []
    const from = drops.at(-1)?.w ?? r.w ?? 0
    return { ...r, drops: [...drops, { w: roundLift(from * 0.8, unit), r: drops.at(-1)?.r ?? r.r ?? 0 }] }
  })
}

export const patchDrop = (s: ActiveSession, ei: number, si: number, di: number, patch: Partial<Drop>) =>
  mapRow(s, ei, si, r => ({ ...r, drops: r.drops?.map((d, i) => (i === di ? { ...d, ...patch } : d)) }))

export function removeDrop(s: ActiveSession, ei: number, si: number, di: number): ActiveSession {
  return mapRow(s, ei, si, r => {
    const drops = r.drops?.filter((_, i) => i !== di)
    const next = { ...r }
    if (drops?.length) next.drops = drops
    else delete next.drops
    return next
  })
}

export function addExercise(p: Profile, s: ActiveSession, exId: string): ActiveSession {
  const entry = buildEntry(p, newSlot(exId, exerciseById(exId)?.c), undefined, s.start)
  return { ...s, entries: [...s.entries, entry], cur: s.entries.length }
}

export function removeExercise(s: ActiveSession, ei: number): ActiveSession {
  const entries = normalizeEntries(s.entries.filter((_, i) => i !== ei))
  const { work: _work, ...rest } = s
  return { ...rest, entries, cur: Math.max(0, Math.min(entries.length - 1, s.cur > ei ? s.cur - 1 : s.cur)) }
}

function swappedSlot(p: Profile, old: Slot | undefined, exId: string, fromId: string): Slot {
  const ex = exerciseById(exId)
  const planned = !old || ex?.c === 'cardio' || ex?.c === 'stretching' || modeOf(old) === 'cardio' ? newSlot(exId, ex?.c) : { ...old, exId }
  const out: Slot = { ...planned, weight: p.exWeights[exId]?.w ?? 0 }
  const subs = [fromId, ...(old?.subs ?? [])].filter(id => id !== exId).slice(0, 5)
  if (subs.length) out.subs = subs
  if (ex?.eq === 'bodyweight') out.bodyweight = true
  else delete out.bodyweight
  return out
}

/** Change the exercise of an entry. Sets already done stay with the old one. */
export function swapExercise(p: Profile, s: ActiveSession, ei: number, exId: string): ActiveSession {
  const e = s.entries[ei]
  if (!e) return s
  const fresh = buildEntry(p, swappedSlot(p, e.target, exId, e.exId), routineOf(p, e.routineId), s.start)
  if (e.routineId) fresh.routineId = e.routineId
  if (e.sg) fresh.sg = e.sg
  const done = e.sets.filter(x => x.done)
  const replaced = done.length ? [{ ...e, sets: done }, fresh] : [fresh]
  const { work: _work, ...rest } = s
  return { ...rest, entries: [...s.entries.slice(0, ei), ...replaced, ...s.entries.slice(ei + 1)], cur: ei + replaced.length - 1 }
}

/** Superset two exercises: the second moves right after the first. */
export function pairExercises(s: ActiveSession, a: number, b: number): ActiveSession {
  if (a === b || !s.entries[a] || !s.entries[b]) return s
  const first = s.entries[a]
  const second = s.entries[b]
  const rest = s.entries.filter((_, i) => i !== b)
  const at = rest.indexOf(first)
  const taken = new Set(s.entries.map(e => e.sg))
  const id = first.sg ?? [...'abcdefghijklmnopqrstuvwxyz'].find(c => !taken.has(c)) ?? `p${a}`
  const list = [...rest.slice(0, at), { ...first, sg: id }, { ...second, sg: id }, ...rest.slice(at + 1)]
  const { work: _work, ...base } = s
  return { ...base, entries: normalizeEntries(list), cur: list.findIndex(e => e.exId === first.exId) }
}

export function splitSuperset(s: ActiveSession, ei: number): ActiveSession {
  return { ...s, entries: normalizeEntries(s.entries.map((e, i) => (i === ei ? { ...e, sg: undefined } : e))) }
}

/** Load volume: an assisted weight helps the lifter, so it is not load. */
export function sessionVolume(entries: Entry[], warmups: boolean): number {
  return workoutVolume(entries.map(e => (e.target?.assisted ? { ...e, sets: e.sets.map(x => ({ ...x, w: 0, drops: undefined })) } : e)), warmups)
}

export interface FinishOptions {
  now?: Ms
  noProg?: boolean
  note?: string
}

/** What a session would save as: done sets only, records against everything before it. */
export function draftWorkout(p: Profile, s: ActiveSession, { now = Date.now(), noProg = false, note = s.note }: FinishOptions = {}): Workout {
  const past = isPast(s)
  const start = past ? pastStart(s.date) : s.start
  const last = s.lastAt ?? s.start
  const end = past ? start : now - last > IDLE_MS ? last : now
  const entries = s.entries
    .map(e => {
      const out: Entry = { ...e, sets: e.sets.filter(x => x.done) }
      const exNote = p.exNotes[e.exId]
      if (exNote) out.note = exNote
      return out
    })
    .filter(e => e.sets.length)
  const prior = p.workouts.filter(w => w.start < start)
  const { prs, e1prs } = detectRecords(entries, prior, p.settings.oneRmFormula)
  const w: Workout = {
    id: s.editingId ?? s.id, date: s.date, start, end, routineIds: s.routineIds, name: s.name, entries, prs, e1prs,
    vol: sessionVolume(entries, p.settings.volumeWarmups), updatedAt: now,
  }
  const bw = [...p.bodyweight].sort((a, b) => a.t - b.t).at(-1)
  if (bw) w.bw = bw.w
  const text = note?.trim()
  if (text) w.note = text
  if (noProg) w.noProg = true
  return w
}

/** Save a workout, end the session and remember the last good weights. */
export function finishSession(p: Profile, w: Workout, now: Ms = Date.now()): Profile {
  const exWeights = { ...p.exWeights }
  if (!w.noProg) {
    for (const e of w.entries) {
      const read = readSession(e)
      if (!read || !(read.weight > 0)) continue
      const had = exWeights[e.exId]
      if (had && had.date > w.date) continue
      if (read.ok || !had) exWeights[e.exId] = { w: read.weight, date: w.date }
    }
  }
  return { ...upsertItem(p, 'workouts', w, now), active: null, exWeights }
}

/** Exercises added on the fly that could join the routine. */
export const addedEntries = (w: Workout) => (w.routineIds.length ? w.entries.filter(e => !e.routineId) : [])

export function addToRoutine(p: Profile, routineId: string, entries: Entry[], now: Ms = Date.now()): Profile {
  const r = routineOf(p, routineId)
  if (!r) return p
  const fresh = entries.filter(e => !r.ex.some(x => x.exId === e.exId)).map(e => {
    const slot = e.target ?? newSlot(e.exId, exerciseById(e.exId)?.c)
    return sanitizeSlot({ ...slot, weight: floorTo(topSet(e)?.w ?? slot.weight, 0.25) })
  })
  return fresh.length ? upsertItem(p, 'routines', { ...r, ex: [...r.ex, ...fresh] }, now) : p
}

export interface NextUp {
  exId: string
  rx: Prescription
  slot: Slot
}

/** What the next session of each exercise will ask for, this one included. */
export function nextTime(p: Profile, w: Workout): NextUp[] {
  const all = [...p.workouts.filter(x => x.id !== w.id), w]
  const seen = new Set<string>()
  const out: NextUp[] = []
  for (const e of w.entries) {
    if (seen.has(e.exId)) continue
    seen.add(e.exId)
    const slot = e.target ?? newSlot(e.exId, exerciseById(e.exId)?.c)
    const rx = nextPrescription({ slot, history: exerciseHistory(all, e.exId), policy: policyOf(slot, routineOf(p, e.routineId)?.prog), inc: incOf(p, slot) })
    out.push({ exId: e.exId, rx, slot })
  }
  return out
}

export interface Comparison {
  date: ISODate
  vol: number
  sets: number
  minutes: number
}

export const workoutMinutes = (w: Pick<Workout, 'start' | 'end'>) => Math.round((w.end - w.start) / 60000)

/** The previous session of the same routine, if any. */
export function previousOfRoutine(p: Profile, w: Workout): Comparison | null {
  if (!w.routineIds.length) return null
  const prev = sortByStart(p.workouts).filter(x => x.id !== w.id && x.start < w.start && x.routineIds.some(id => w.routineIds.includes(id))).at(-1)
  return prev ? { date: prev.date, vol: prev.vol, sets: setsDone(prev.entries), minutes: workoutMinutes(prev) } : null
}

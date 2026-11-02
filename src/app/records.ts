import { exerciseById } from '../catalogue'
import { detectRecords, isoDate, parseIso, sortByStart } from '../core/history'
import { readSession } from '../core/progression'
import type { ActiveSession, Entry, ISODate, Ms, Profile, SetRow, Settings, Workout } from '../core/types'
import { newId } from './plan'
import { deleteItem, upsertItem } from './profile'
import { buildEntry, entryMode, sessionVolume } from './session'
import { newSlot } from './slots'

type Calc = Pick<Settings, 'oneRmFormula' | 'volumeWarmups'>

const sameIds = (a: string[] = [], b: string[] = []) => a.length === b.length && a.every(x => b.includes(x))

/**
 * Volume and records of every workout that starts at `from` or later (and before
 * `until`), judged against everything before it. Workouts that come out the same keep their identity.
 */
export function recomputeRecords(workouts: Workout[], calc: Calc, from: Ms = -Infinity, now: Ms = Date.now(), until: Ms = Infinity): Workout[] {
  const sorted = sortByStart(workouts)
  const fixed = new Map<string, Workout>()
  for (const w of sorted) {
    if (w.start < from || w.start >= until) continue
    const prior = sorted.filter(x => x.start < w.start)
    const { prs, e1prs } = detectRecords(w.entries, prior, calc.oneRmFormula)
    const vol = sessionVolume(w.entries, calc.volumeWarmups)
    if (vol !== w.vol || !sameIds(prs, w.prs) || !sameIds(e1prs, w.e1prs)) fixed.set(w.id, { ...w, vol, prs, e1prs, updatedAt: now })
  }
  return fixed.size ? workouts.map(w => fixed.get(w.id) ?? w) : workouts
}

/** "Last good weight" per exercise, read again from what the history now says. */
export function refreshExWeights(p: Profile, ids: Iterable<string>): Profile {
  const out = { ...p.exWeights }
  const sorted = sortByStart(p.workouts).filter(w => !w.noProg)
  for (const id of new Set(ids)) {
    let had: { w: number; date: ISODate } | undefined
    for (const w of sorted) {
      for (const e of w.entries) {
        if (e.exId !== id) continue
        const read = readSession(e)
        if (read && read.weight > 0 && (read.ok || !had)) had = { w: read.weight, date: w.date }
      }
    }
    if (had) out[id] = had
  }
  return { ...p, exWeights: out }
}

const exIds = (w?: Workout) => (w ? w.entries.map(e => e.exId) : [])

/** Store a new or edited workout and bring all later workouts in line with it. */
export function saveWorkout(p: Profile, w: Workout, now: Ms = Date.now()): Profile {
  const old = p.workouts.find(x => x.id === w.id)
  const next = upsertItem(p, 'workouts', w, now)
  const from = Math.min(w.start, old?.start ?? Infinity)
  return refreshExWeights({ ...next, workouts: recomputeRecords(next.workouts, p.settings, from, now) }, [...exIds(old), ...exIds(w)])
}

/** Remove with a tombstone; workouts after it are judged again without it. */
export function deleteWorkout(p: Profile, id: string, now: Ms = Date.now()): Profile {
  const old = p.workouts.find(x => x.id === id)
  if (!old) return p
  const next = deleteItem(p, 'workouts', id, now)
  return refreshExWeights({ ...next, workouts: recomputeRecords(next.workouts, p.settings, old.start, now) }, exIds(old))
}

const pad = (n: number) => String(n).padStart(2, '0')

export const timeOf = (t: Ms) => {
  const d = new Date(t)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Local date and HH:MM plus a length in minutes, as start and end times. */
export function workoutTimes(date: ISODate, time: string, minutes: number): { start: Ms; end: Ms } {
  const [h, m] = time.split(':').map(Number)
  const d = parseIso(date)
  d.setHours(h || 0, m || 0, 0, 0)
  const start = d.getTime()
  return { start, end: start + Math.max(0, Math.round(minutes)) * 60000 }
}

/** An empty workout written down later, from paper. */
export function blankWorkout(name: string, date: ISODate, now: Ms = Date.now(), makeId: () => string = newId): Workout {
  const { start, end } = workoutTimes(date, '12:00', 60)
  return { id: makeId(), date, start, end, routineIds: [], name, entries: [], prs: [], vol: 0, updatedAt: now }
}

function rowFor(e: Entry): SetRow {
  const mode = entryMode(e)
  const last = e.sets.filter(s => !s.warmup).at(-1) ?? e.sets.at(-1)
  if (mode === 'cardio') return { min: last?.min ?? e.target?.min ?? 10, speed: last?.speed, incline: last?.incline, done: true }
  if (mode === 'time') return { w: last?.w, sec: last?.sec ?? e.target?.sec ?? 30, done: true }
  return { w: last?.w, r: last?.r, done: true }
}

export const addRow = (e: Entry): Entry => ({ ...e, sets: [...e.sets, rowFor(e)] })

export function newEntry(exId: string): Entry {
  const entry: Entry = { exId, sets: [], target: newSlot(exId, exerciseById(exId)?.c) }
  return addRow(entry)
}

/** The same sets on another exercise; a change of kind starts over. */
export function swapEntry(e: Entry, exId: string): Entry {
  const fresh = newEntry(exId)
  return entryMode(fresh) === entryMode(e) ? { ...e, exId, target: fresh.target, rx: undefined } : fresh
}

/** Edit a logged set; a per-side set stays consistent with its total. */
export function patchRow(row: SetRow, patch: Pick<SetRow, 'w' | 'r' | 'sec' | 'min'>): SetRow {
  const next = { ...row, ...patch }
  if (!row.sides) return next
  const L = { ...row.sides.L }
  const R = { ...row.sides.R }
  if ('w' in patch) {
    L.w = patch.w
    R.w = patch.w
  }
  if ('r' in patch) {
    const r = patch.r ?? 0
    L.r = Math.ceil(r / 2)
    R.r = Math.floor(r / 2)
  }
  return { ...next, sides: { L, R } }
}

const hasWork = (s: SetRow) => (s.r ?? 0) > 0 || (s.sec ?? 0) > 0 || (s.min ?? 0) > 0 || (s.km ?? 0) > 0

/** What an edit form saves: rows with something in them, all of them done. */
export function cleanEntries(entries: Entry[]): Entry[] {
  return entries
    .map(e => ({ ...e, sets: e.sets.filter(hasWork).map(s => ({ ...s, done: true })) }))
    .filter(e => e.sets.length > 0)
}

function freshRow(s: SetRow): SetRow {
  const { rir: _rir, rpe: _rpe, failure: _failure, ...rest } = s
  const row: SetRow = { ...rest, done: false }
  if (s.sides) row.sides = { L: { ...s.sides.L, done: false }, R: { ...s.sides.R, done: false } }
  return row
}

/** A new session with the same exercises and numbers as an old one. */
export function repeatSession(p: Profile, w: Workout, now: Ms = Date.now(), makeId: () => string = newId): ActiveSession {
  const routines = w.routineIds.filter(id => p.routines.some(r => r.id === id))
  const entries = w.entries.map(e => {
    const routine = p.routines.find(r => r.id === e.routineId)
    const built = buildEntry(p, e.target ?? newSlot(e.exId, exerciseById(e.exId)?.c), routine, now)
    const out: Entry = { ...built, sets: e.sets.map(freshRow) }
    if (e.sg) out.sg = e.sg
    return out
  })
  return { id: makeId(), date: isoDate(new Date(now)), start: now, routineIds: routines, name: w.name, entries, cur: 0 }
}

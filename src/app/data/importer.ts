import { exerciseById } from '../../catalogue'
import type { CustomExercise, Entry, ISODate, Ms, Profile, SetRow, Unit, Workout } from '../../core/types'
import { convert, roundLift } from '../../core/units'
import { newId } from '../plan'
import { recomputeRecords, refreshExWeights, workoutTimes } from '../records'
import type { Tick } from './csv'
import type { ImportRow, ParsedFile } from './formats'
import type { NameMatch } from './names'

export const NEW_EXERCISE = 'new'
const MI_TO_KM = 1.609344
const NOTE_MAX = 500
const NAME_MAX = 80
const RECOMPUTE_BATCH = 8

/** What each file name becomes: an exercise id, or NEW_EXERCISE. */
export type Choices = Record<string, string>

export const defaultChoices = (matches: NameMatch[]): Choices =>
  Object.fromEntries(matches.map(m => [m.name, m.exId ?? NEW_EXERCISE]))

export const namesIn = (file: ParsedFile) => [...new Set(file.rows.map(r => r.exercise))]

export interface BuildOptions {
  choices: Choices
  matches: NameMatch[]
  /** Unit of rows that state none. */
  unit?: Unit
  /** Name for workouts the file does not name. */
  defaultName: string
  now?: Ms
  makeId?: () => string
}

export interface BuiltImport {
  workouts: Workout[]
  customEx: CustomExercise[]
  sets: number
  skippedDays: ISODate[]
  /** File names that end up in a workout; those on skipped days do not. */
  names: Set<string>
  from?: ISODate
  to?: ISODate
}

const addNote = (old: string | undefined, text: string | undefined) => {
  if (!text || old?.includes(text)) return old
  return (old ? `${old}; ${text}` : text).slice(0, NOTE_MAX)
}

const r2 = (v: number) => Math.round(v * 100) / 100
/** A weighted lunge or carry over a distance, with no time: a strength set, the distance goes to the note. */
const isLoadedDistance = (r: ImportRow) => r.w != null && !r.sec && (r.km != null || r.distance != null)
const kmOf = (r: ImportRow, fileUnit: Unit) => r.km ?? (r.distance != null ? (fileUnit === 'lb' ? r.distance * MI_TO_KM : r.distance) : undefined)

function toSet(r: ImportRow, w: number | undefined, km: number | undefined, cardio: boolean): SetRow {
  const row: SetRow = { done: true }
  if ((km != null && !isLoadedDistance(r)) || (cardio && r.sec != null && r.r == null)) {
    row.min = r2((r.sec ?? 0) / 60)
    if (km != null) row.km = r2(km)
    if (km != null && r.sec) row.speed = r2(km / (r.sec / 3600))
  } else if (r.r != null || r.sec == null) {
    if (w != null) row.w = w
    row.r = r.r ?? 0
  } else {
    if (w != null) row.w = w
    row.sec = r.sec
  }
  if (r.kind === 'warmup') row.warmup = true
  if (r.kind === 'failure') row.failure = true
  if (r.rpe != null) row.rpe = r.rpe
  if (r.rir != null) row.rir = r.rir
  return row
}

/** Turn parsed rows into workouts. Days that already have a workout are left alone. */
export function buildImport(file: ParsedFile, p: Profile, opts: BuildOptions): BuiltImport {
  const { now = Date.now(), makeId = newId, choices, matches, defaultName } = opts
  const to = p.settings.unit
  const fileUnit = opts.unit ?? to
  const taken = new Set(p.workouts.map(w => w.date))
  const skipped = new Set<ISODate>()
  const groups = new Map<string, ImportRow[]>()
  const distanced = new Set<string>()
  const names = new Set<string>()
  for (const r of file.rows) {
    if (taken.has(r.date)) {
      skipped.add(r.date)
      continue
    }
    const key = `${r.date}|${r.time ?? ''}|${r.workout ?? ''}`
    const list = groups.get(key)
    if (list) list.push(r)
    else groups.set(key, [r])
    names.add(r.exercise)
    if ((r.km != null || r.distance != null) && !isLoadedDistance(r)) distanced.add(r.exercise)
  }

  const equipment = new Map(matches.map(m => [m.name, m.equipment]))
  const fresh = new Map<string, CustomExercise>()
  const idOf = (name: string) => {
    const choice = choices[name] ?? NEW_EXERCISE
    if (choice !== NEW_EXERCISE) return choice
    let c = fresh.get(name)
    if (!c) {
      c = {
        id: `custom-${makeId()}`, name: name.slice(0, NAME_MAX), bodyPart: 'other', equipment: equipment.get(name) ?? 'other',
        primary: [], secondary: [], category: distanced.has(name) ? 'cardio' : 'strength', updatedAt: now,
      }
      fresh.set(name, c)
    }
    return c.id
  }
  const isCardio = (name: string, id: string) => distanced.has(name) || exerciseById(id)?.c === 'cardio'
  const weight = (r: ImportRow) => {
    if (r.w == null) return undefined
    const from = r.unit ?? fileUnit
    return from === to ? r.w : roundLift(convert(r.w, from, to), to)
  }

  let sets = 0
  const workouts: Workout[] = []
  for (const rows of groups.values()) {
    const first = rows[0]
    const length = rows.find(r => r.length != null)?.length ?? 0
    const time = first.time ?? '12:00'
    const start = workoutTimes(first.date, time, 0).start
    const entries: Entry[] = []
    for (const r of rows) {
      const exId = idOf(r.exercise)
      let e = entries.find(x => x.exId === exId)
      if (!e) entries.push((e = { exId, sets: [] }))
      const w = weight(r)
      const last = e.sets.at(-1)
      if (r.kind === 'drop' && last && r.r != null && w != null) {
        last.drops = [...(last.drops ?? []), { w, r: r.r }]
      } else {
        const km = kmOf(r, fileUnit)
        e.sets.push(toSet(r, w, km, isCardio(r.exercise, exId)))
        sets++
        if (km != null && !r.sec) e.note = addNote(e.note, `${r2(km)} km`)
      }
      e.note = addNote(e.note, r.note)
      if (r.superset && !e.sg) e.sg = r.superset
      if (!e.note) delete e.note
      if (!e.sg) delete e.sg
    }
    const w: Workout = {
      id: makeId(), date: first.date, start, end: start + Math.round(length) * 1000, routineIds: [], name: first.workout || defaultName,
      entries, prs: [], vol: 0, updatedAt: now,
    }
    const note = rows.find(r => r.workoutNote)?.workoutNote
    if (note) w.note = note.slice(0, NOTE_MAX)
    workouts.push(w)
  }
  workouts.sort((a, b) => a.start - b.start)

  const out: BuiltImport = { workouts, customEx: [...fresh.values()], sets, skippedDays: [...skipped].sort(), names }
  if (workouts.length) {
    out.from = workouts[0].date
    out.to = workouts.at(-1)!.date
  }
  return out
}

/** Add the built workouts, then judge volume and records from the earliest of them on. */
export async function applyImport(p: Profile, built: BuiltImport, tick: Tick = async () => {}, now: Ms = Date.now()): Promise<Profile> {
  if (!built.workouts.length) return p
  let workouts = [...p.workouts, ...built.workouts]
  const from = built.workouts[0].start
  const starts = [...new Set(workouts.filter(w => w.start >= from).map(w => w.start))].sort((a, b) => a - b)
  for (let i = 0; i < starts.length; i += RECOMPUTE_BATCH) {
    workouts = recomputeRecords(workouts, p.settings, starts[i], now, starts[i + RECOMPUTE_BATCH] ?? Infinity)
    await tick(i)
  }
  const ids = built.workouts.flatMap(w => w.entries.map(e => e.exId))
  return refreshExWeights({ ...p, customEx: [...p.customEx, ...built.customEx], workouts }, ids)
}

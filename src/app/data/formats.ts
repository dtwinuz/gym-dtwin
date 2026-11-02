import type { ISODate, Unit } from '../../core/types'
import { csvRows, type Tick } from './csv'

export type Format = 'strong' | 'hevy' | 'fitnotes' | 'generic'
export type SetKind = 'normal' | 'warmup' | 'failure' | 'drop'

export interface ImportRow {
  date: ISODate
  /** HH:MM; absent when the file has dates only. */
  time?: string
  /** Workout length in seconds. */
  length?: number
  workout?: string
  workoutNote?: string
  exercise: string
  kind: SetKind
  w?: number
  /** Unit the row states; absent means the one the user picks for the file. */
  unit?: Unit
  r?: number
  sec?: number
  km?: number
  /** A distance with no unit: km, or miles in a file logged in lb. */
  distance?: number
  rpe?: number
  rir?: number
  note?: string
  superset?: string
}

export interface ParsedFile {
  format: Format
  rows: ImportRow[]
  /** Rows with no usable date or exercise. */
  bad: number
  /** Rest timers and rows with no numbers in them. */
  skipped: number
  needsUnit: boolean
}

type Field =
  | 'date' | 'end' | 'workout' | 'workoutNote' | 'duration' | 'exercise' | 'order' | 'type' | 'superset'
  | 'weight' | 'weightKg' | 'weightLb' | 'unit' | 'reps' | 'distance' | 'distanceKm' | 'distanceMi' | 'distanceUnit'
  | 'sec' | 'time' | 'note' | 'rpe' | 'rir'

const WEIGHT_KG = ['weightkg', 'weightkgs']
const WEIGHT_LB = ['weightlb', 'weightlbs']

const COLUMNS: Record<Format, Partial<Record<Field, string[]>>> = {
  strong: {
    date: ['date'], workout: ['workoutname'], duration: ['duration', 'workoutduration'], exercise: ['exercisename'], order: ['setorder'],
    weight: ['weight'], weightKg: WEIGHT_KG, weightLb: WEIGHT_LB, unit: ['weightunit'], reps: ['reps'],
    distance: ['distance'], distanceUnit: ['distanceunit'], sec: ['seconds'], note: ['notes'], workoutNote: ['workoutnotes'], rpe: ['rpe'],
  },
  hevy: {
    date: ['starttime'], end: ['endtime'], workout: ['title'], workoutNote: ['description'], exercise: ['exercisetitle'],
    superset: ['supersetid'], note: ['exercisenotes'], type: ['settype'], weightKg: WEIGHT_KG, weightLb: WEIGHT_LB, reps: ['reps'],
    distanceKm: ['distancekm'], distanceMi: ['distancemiles', 'distancemi'], sec: ['durationseconds'], rpe: ['rpe'],
  },
  fitnotes: {
    date: ['date'], exercise: ['exercise'], weight: ['weight'], weightKg: WEIGHT_KG, weightLb: WEIGHT_LB, unit: ['weightunit'], reps: ['reps'],
    distance: ['distance'], distanceUnit: ['distanceunit'], time: ['time'], note: ['comment'],
  },
  generic: {
    date: ['date', 'day', 'datetime', 'workoutdate', 'starttime', 'start', 'sana', 'дата'],
    end: ['endtime', 'end'],
    exercise: ['exercise', 'exercisename', 'exercisetitle', 'movement', 'lift', 'mashq', 'упражнение'],
    workout: ['workoutname', 'workout', 'routine', 'session', 'title', 'mashgulot', 'тренировка'],
    workoutNote: ['workoutnotes', 'workoutnote'],
    weight: ['weight', 'load', 'vazn', 'вес'],
    weightKg: [...WEIGHT_KG, 'kg', 'кг'],
    weightLb: [...WEIGHT_LB, 'lb', 'lbs'],
    unit: ['unit', 'units', 'weightunit', 'birlik', 'единица'],
    reps: ['reps', 'rep', 'repetitions', 'takror', 'повторения', 'повторы'],
    rpe: ['rpe'],
    rir: ['rir'],
    duration: ['duration', 'time', 'vaqt', 'длительность', 'время'],
    sec: ['seconds', 'second', 'sec', 'secs', 'durationseconds'],
    distance: ['distance', 'masofa', 'дистанция'],
    distanceKm: ['distancekm', 'km', 'км'],
    distanceMi: ['distancemiles', 'distancemi', 'miles'],
    distanceUnit: ['distanceunit'],
    type: ['settype', 'type', 'turi', 'тип'],
    note: ['notes', 'note', 'comment', 'comments', 'izoh', 'заметка', 'заметки', 'комментарий'],
  },
}

/** Case and punctuation do not matter: "Weight (kgs)" and "weight_kgs" are the same. */
export const headerKey = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

const has = (keys: Set<string>, list: string[] = []) => list.some(k => keys.has(k))

export function detectFormat(header: string[]): Format | null {
  const keys = new Set(header.map(headerKey))
  if (keys.has('exercisetitle') && keys.has('starttime')) return 'hevy'
  if (keys.has('exercisename') && keys.has('setorder')) return 'strong'
  if (keys.has('date') && keys.has('exercise') && keys.has('category') && has(keys, ['comment', 'weightunit', 'distanceunit', 'time'])) return 'fitnotes'
  const g = COLUMNS.generic
  const measured = [g.weight, g.weightKg, g.weightLb, g.reps, g.duration, g.sec, g.distance, g.distanceKm, g.distanceMi].some(list => has(keys, list))
  return has(keys, g.date) && has(keys, g.exercise) && measured ? 'generic' : null
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const CLOCK = '(?:[ T,]+(\\d{1,2}):(\\d{2})(?::\\d{2}(?:\\.\\d+)?)?\\s*([ap]m)?)?'
const RE_ISO = new RegExp(`^(\\d{4})[-/](\\d{1,2})[-/](\\d{1,2})${CLOCK}$`, 'i')
const RE_ZONED = /^\d{4}-\d{2}-\d{2}T?\s*\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/i
const RE_DOT = new RegExp(`^(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})${CLOCK}$`, 'i')
const RE_SLASH = new RegExp(`^(\\d{1,2})/(\\d{1,2})/(\\d{4})${CLOCK}$`, 'i')
const RE_DAY_NAME = new RegExp(`^(\\d{1,2})\\s+([a-z]{3,})\\.?,?\\s+(\\d{4})${CLOCK}$`, 'i')
const RE_NAME_DAY = new RegExp(`^([a-z]{3,})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})${CLOCK}$`, 'i')

const pad = (n: number) => String(n).padStart(2, '0')

function stamp(y: number, m: number, d: number, h?: string, min?: string, ampm?: string) {
  const when = new Date(y, m - 1, d)
  if (m < 1 || m > 12 || when.getMonth() !== m - 1 || when.getDate() !== d) return null
  const out: { date: ISODate; time?: string } = { date: `${y}-${pad(m)}-${pad(d)}` }
  if (h != null) {
    let hour = Number(h)
    if (ampm) hour = (hour % 12) + (/p/i.test(ampm) ? 12 : 0)
    if (hour > 23 || Number(min) > 59) return null
    out.time = `${pad(hour)}:${min}`
  }
  return out
}

const monthOf = (s: string) => MONTHS.indexOf(s.slice(0, 3).toLowerCase()) + 1

/** Dates as the apps write them. A/B/YYYY is month first unless `dayFirst`. */
export function parseStamp(text: string, dayFirst = false) {
  const s = text.trim()
  if (RE_ZONED.test(s)) {
    const d = new Date(s.replace(' ', 'T'))
    if (Number.isNaN(d.getTime())) return null
    return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
  }
  let m = RE_ISO.exec(s)
  if (m) return stamp(+m[1], +m[2], +m[3], m[4], m[5], m[6])
  m = RE_DOT.exec(s)
  if (m) return stamp(+m[3], +m[2], +m[1], m[4], m[5], m[6])
  m = RE_SLASH.exec(s)
  if (m) return dayFirst ? stamp(+m[3], +m[2], +m[1], m[4], m[5], m[6]) : stamp(+m[3], +m[1], +m[2], m[4], m[5], m[6])
  m = RE_DAY_NAME.exec(s)
  if (m) return stamp(+m[3], monthOf(m[2]), +m[1], m[4], m[5], m[6])
  m = RE_NAME_DAY.exec(s)
  if (m) return stamp(+m[3], monthOf(m[1]), +m[2], m[4], m[5], m[6])
  return null
}

/** A/B/YYYY with A over 12 anywhere in the file means the whole file is day first. */
export function slashIsDayFirst(values: string[]) {
  for (const v of values) {
    const m = /^(\d{1,2})\/(\d{1,2})\/\d{4}/.exec(v.trim())
    if (m && +m[1] > 12) return true
    if (m && +m[2] > 12) return false
  }
  return false
}

/** "1h 5m", "45m", "90s", "1:02:03", "2:30". A bare number is taken as `bare`. */
export function parseDuration(text: string, bare: (n: number) => number = n => n): number | undefined {
  const s = text.trim().toLowerCase()
  if (!s) return undefined
  const clock = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(s)
  if (clock) return clock[3] != null ? +clock[1] * 3600 + +clock[2] * 60 + +clock[3] : +clock[1] * 60 + +clock[2]
  const parts = /^(?:(\d+)\s*h\w*)?\s*(?:(\d+)\s*m\w*)?\s*(?:(\d+)\s*s\w*)?$/.exec(s)
  if (parts && (parts[1] || parts[2] || parts[3])) return +(parts[1] ?? 0) * 3600 + +(parts[2] ?? 0) * 60 + +(parts[3] ?? 0)
  const n = parseNumber(s)
  return n == null ? undefined : bare(n)
}

/** A workout that long in plain numbers is seconds; a small number is minutes. */
const workoutBare = (n: number) => (n >= 600 ? n : n * 60)

/** "62,5", "1,000.5", "62.5"; negatives and text are undefined. */
export function parseNumber(text: string): number | undefined {
  let s = text.trim().replace(/\s/g, '')
  if (!s) return undefined
  if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, '')
  else s = s.replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

const unitOf = (text: string): Unit | undefined => {
  const s = text.trim().toLowerCase()
  if (/^(kg|kgs|kilo|kilos|kilograms?|кг)$/.test(s)) return 'kg'
  if (/^(lb|lbs|pounds?|фунт\S*)$/.test(s)) return 'lb'
  return undefined
}

const KM_PER = { km: 1, m: 0.001, mi: 1.609344, ft: 0.0003048, yd: 0.0009144 }

function toKm(n: number, unit: string): number | undefined {
  const s = unit.trim().toLowerCase()
  if (/^(km|kms|kilomet\w*|км)$/.test(s)) return n * KM_PER.km
  if (/^(m|met\w*|м)$/.test(s)) return n * KM_PER.m
  if (/^(mi|mile|miles)$/.test(s)) return n * KM_PER.mi
  if (/^(ft|feet)$/.test(s)) return n * KM_PER.ft
  if (/^(yd|yard|yards)$/.test(s)) return n * KM_PER.yd
  return undefined
}

function kindOf(text: string): SetKind {
  const s = text.trim().toLowerCase()
  if (s === 'w' || /warm|размин/.test(s)) return 'warmup'
  if (s === 'd' || /drop|дроп/.test(s)) return 'drop'
  if (s === 'f' || /fail|отказ/.test(s)) return 'failure'
  return 'normal'
}

const pos = (n: number | undefined) => (n != null && n > 0 ? n : undefined)
const inRange = (n: number | undefined, lo: number, hi: number) => (n != null && n >= lo && n <= hi ? n : undefined)

function readRow(format: Format, get: (f: Field) => string, dayFirst: boolean): ImportRow | 'skip' | 'bad' {
  let kind = kindOf(get('type'))
  if (format === 'strong') {
    const order = get('order').toLowerCase()
    if (!/^(\d+|w|d|f)$/.test(order)) return 'skip'
    kind = kindOf(order)
  }
  const when = parseStamp(get('date'), dayFirst)
  const exercise = get('exercise')
  if (!when || !exercise) return 'bad'

  const kg = pos(parseNumber(get('weightKg')))
  const lb = pos(parseNumber(get('weightLb')))
  const plain = /^(.*?)\s*([a-zа-я]+)?$/i.exec(get('weight'))
  const w = kg ?? lb ?? pos(parseNumber(plain?.[1] ?? ''))
  const unit = kg != null ? 'kg' : lb != null ? 'lb' : unitOf(get('unit')) ?? unitOf(plain?.[2] ?? '')
  const r = pos(parseNumber(get('reps')))

  let sec = pos(parseNumber(get('sec'))) ?? pos(parseDuration(get('time')))
  let length = pos(parseDuration(get('duration'), workoutBare))
  if (format === 'generic' && r == null && w == null && sec == null) {
    sec = pos(parseDuration(get('duration')))
    length = undefined
  }

  const rawDistance = pos(parseNumber(get('distance')))
  const km = pos(parseNumber(get('distanceKm')))
    ?? (pos(parseNumber(get('distanceMi'))) ?? 0) * KM_PER.mi
    + (rawDistance != null ? toKm(rawDistance, get('distanceUnit')) ?? 0 : 0)
  const distance = rawDistance != null && !km ? rawDistance : undefined

  if (w == null && r == null && sec == null && !km && distance == null) return 'skip'

  const row: ImportRow = { date: when.date, exercise, kind }
  if (when.time) row.time = when.time
  const end = get('end') ? parseStamp(get('end'), dayFirst) : null
  if (end?.time && when.time) {
    const startMs = new Date(`${when.date}T${when.time}`).getTime()
    const endMs = new Date(`${end.date}T${end.time}`).getTime()
    if (endMs > startMs) length = (endMs - startMs) / 1000
  }
  if (length != null) row.length = length
  if (get('workout')) row.workout = get('workout')
  if (get('workoutNote')) row.workoutNote = get('workoutNote')
  if (w != null) row.w = w
  if (unit) row.unit = unit
  if (r != null) row.r = Math.round(r)
  if (sec != null) row.sec = Math.round(sec)
  if (km) row.km = km
  if (distance != null) row.distance = distance
  const rpe = inRange(parseNumber(get('rpe')), 1, 10)
  if (rpe != null) row.rpe = rpe
  const rir = inRange(parseNumber(get('rir')), 0, 10)
  if (rir != null) row.rir = rir
  if (get('note')) row.note = get('note')
  if (get('superset')) row.superset = get('superset')
  return row
}

/** Read a whole file; null when its headers are not a workout log we know. */
export async function parseImport(text: string, tick: Tick = async () => {}): Promise<ParsedFile | null> {
  const table: string[][] = []
  for (const row of csvRows(text)) {
    table.push(row)
    if (table.length % 500 === 0) await tick(table.length)
  }
  if (table[0]?.length === 1 && /^sep=/i.test(table[0][0])) table.shift()
  const header = table.shift()
  const format = header && detectFormat(header)
  if (!header || !format) return null

  const keys = header.map(headerKey)
  const col = new Map<Field, number>()
  for (const [field, names] of Object.entries(COLUMNS[format]) as [Field, string[]][]) {
    const name = names.find(n => keys.includes(n))
    if (name) col.set(field, keys.indexOf(name))
  }
  const dateCol = col.get('date') ?? 0
  const dayFirst = slashIsDayFirst(table.map(r => r[dateCol] ?? ''))

  const out: ParsedFile = { format, rows: [], bad: 0, skipped: 0, needsUnit: false }
  for (let i = 0; i < table.length; i++) {
    const cells = table[i]
    const get = (f: Field) => {
      const c = col.get(f)
      return c == null ? '' : (cells[c] ?? '').trim()
    }
    const row = readRow(format, get, dayFirst)
    if (row === 'bad') out.bad++
    else if (row === 'skip') out.skipped++
    else {
      out.rows.push(row)
      if (row.w != null && !row.unit) out.needsUnit = true
    }
    if (i % 500 === 0) await tick(i)
  }
  return out
}

import { parseIso } from '../core/history'
import type { ISODate, Measurement, Ms, Profile, Settings, Unit, WeighIn } from '../core/types'
import { addWeighIn } from './plan'
import { liftTombstone, markDeleted } from './profile'

const DAY = 86_400_000
const WEEK_DAYS = 7
const RATE_WINDOW_DAYS = 28
const MIN_SPAN_DAYS = 3
const CM_PER_IN = 2.54
/** Below this per week (in kg) a weight counts as holding steady. */
const STEADY_KG = 0.2
const LB_PER_KG = 2.2046226218

export const MEASURES = ['waist', 'chest', 'hip', 'thigh', 'arm', 'calf', 'neck'] as const
export type MeasureKey = (typeof MEASURES)[number]
export const isBuiltinMeasure = (k: string): k is MeasureKey => (MEASURES as readonly string[]).includes(k)

export const lengthUnit = (u: Unit) => (u === 'lb' ? 'in' : 'cm')

/** Measurements are stored in cm whatever the unit setting says. */
export const toDisplayLength = (cm: number, u: Unit) => (u === 'lb' ? Math.round((cm / CM_PER_IN) * 10) / 10 : cm)
export const fromDisplayLength = (v: number, u: Unit) => (u === 'lb' ? Math.round(v * CM_PER_IN * 100) / 100 : v)

/** Change per week: the slope of a straight line through the last four weeks. */
export function weeklyRate(points: Pick<WeighIn, 'date' | 'w'>[], windowDays = RATE_WINDOW_DAYS): number | null {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const last = sorted.at(-1)
  if (!last) return null
  const end = parseIso(last.date).getTime()
  const xs = sorted
    .map(p => ({ d: (parseIso(p.date).getTime() - end) / DAY, w: p.w }))
    .filter(p => p.d >= -windowDays)
  if (xs.length < 2 || -xs[0].d < MIN_SPAN_DAYS) return null
  const mx = xs.reduce((s, p) => s + p.d, 0) / xs.length
  const my = xs.reduce((s, p) => s + p.w, 0) / xs.length
  const den = xs.reduce((s, p) => s + (p.d - mx) ** 2, 0)
  if (den === 0) return null
  const slope = xs.reduce((s, p) => s + (p.d - mx) * (p.w - my), 0) / den
  return Math.round(slope * WEEK_DAYS * 100) / 100
}

export type GoalFit = 'match' | 'opposite' | 'steady'

/** Whether the weekly rate points where the goal does. */
export function goalFit(rate: number, goal: Settings['weightGoal'], unit: Unit): GoalFit {
  const steady = Math.abs(rate) < (unit === 'lb' ? STEADY_KG * LB_PER_KG : STEADY_KG)
  if (goal === 'hold') return steady ? 'match' : 'opposite'
  if (steady) return 'steady'
  return (rate < 0) === (goal === 'lose') ? 'match' : 'opposite'
}

export function saveWeighIn(p: Profile, w: number, date: ISODate, was?: ISODate, now: Ms = Date.now()): Profile {
  const base = was && was !== date ? removeWeighIn(p, was, now) : p
  return addWeighIn(base, w, date, now)
}

export function removeWeighIn(p: Profile, date: ISODate, now: Ms = Date.now()): Profile {
  return markDeleted({ ...p, bodyweight: p.bodyweight.filter(b => b.date !== date) }, 'bodyweight', date, now)
}

/** One entry per date: saving a date again replaces it. */
export function saveMeasurement(p: Profile, date: ISODate, values: Record<string, number>, was?: ISODate, now: Ms = Date.now()): Profile {
  const base = was && was !== date ? removeMeasurement(p, was, now) : p
  const entry: Measurement = { date, t: now, values }
  return liftTombstone({ ...base, measurements: [...base.measurements.filter(m => m.date !== date), entry] }, 'measurements', date)
}

export function removeMeasurement(p: Profile, date: ISODate, now: Ms = Date.now()): Profile {
  return markDeleted({ ...p, measurements: p.measurements.filter(m => m.date !== date) }, 'measurements', date, now)
}

/** Built-in measures first, then whatever custom names the entries hold. */
export function measureKeys(list: Measurement[]): string[] {
  const custom = new Set<string>()
  for (const m of list) for (const k of Object.keys(m.values)) if (!isBuiltinMeasure(k)) custom.add(k)
  return [...MEASURES, ...[...custom].sort()]
}

export function measureSeries(list: Measurement[], key: string): { date: ISODate; v: number }[] {
  return list
    .filter(m => m.values[key] != null)
    .map(m => ({ date: m.date, v: m.values[key] }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

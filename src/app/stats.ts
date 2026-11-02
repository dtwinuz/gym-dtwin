import { addDays, bestE1rm, bestLoad, isoDate, parseIso, setsDone, sortByStart, weekKey } from '../core/history'
import { e1rm } from '../core/onerm'
import type { ExerciseLookup } from '../core/muscles'
import type { Entry, ISODate, Ms, OneRmFormula, WeighIn, Workout } from '../core/types'

export type Period = '1m' | '3m' | '1y' | 'all'
export const PERIODS: Period[] = ['1m', '3m', '1y', 'all']
const MONTHS: Record<Exclude<Period, 'all'>, number> = { '1m': 1, '3m': 3, '1y': 12 }

function addMonths(iso: ISODate, n: number): ISODate {
  const d = parseIso(iso)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return isoDate(d)
}

export interface Range {
  from: ISODate | null
  to: ISODate
  prevFrom: ISODate | null
  prevTo: ISODate | null
}

/** The chosen period ending today and the same length right before it. */
export function periodRange(period: Period, today: ISODate): Range {
  if (period === 'all') return { from: null, to: today, prevFrom: null, prevTo: null }
  const n = MONTHS[period]
  const from = addDays(addMonths(today, -n), 1)
  return { from, to: today, prevFrom: addDays(addMonths(today, -2 * n), 1), prevTo: addDays(from, -1) }
}

const within = (w: Workout, from: ISODate | null, to: ISODate | null) => (!from || w.date >= from) && (!to || w.date <= to)

export interface Totals {
  workouts: number
  volume: number
  sets: number
  minutes: number
}

export function aggregate(workouts: Workout[], from: ISODate | null, to: ISODate | null): Totals {
  const out: Totals = { workouts: 0, volume: 0, sets: 0, minutes: 0 }
  for (const w of workouts) {
    if (!within(w, from, to)) continue
    out.workouts++
    out.volume += w.vol
    out.sets += setsDone(w.entries)
    out.minutes += Math.max(0, Math.round((w.end - w.start) / 60000))
  }
  return out
}

/** Change against the previous period; pct is null when there is nothing to divide by. */
export function delta(now: number, prev: number): { diff: number; pct: number | null } {
  return { diff: now - prev, pct: prev > 0 ? Math.round(((now - prev) / prev) * 100) : null }
}

export interface HeatDay {
  date: ISODate
  sets: number
  level: 0 | 1 | 2 | 3 | 4
  /** After today: drawn as nothing. */
  future: boolean
}

/** Weeks x weekdays ending with the current week; each column starts on weekStart. */
export function heatmapWeeks(workouts: Workout[], weekStart: 0 | 1, today: ISODate, weeks = 53): HeatDay[][] {
  const sets = new Map<string, number>()
  for (const w of workouts) sets.set(w.date, (sets.get(w.date) ?? 0) + Math.max(1, setsDone(w.entries)))
  const first = addDays(weekKey(parseIso(today), weekStart), -7 * (weeks - 1))
  const max = Math.max(1, ...[...sets.entries()].filter(([d]) => d >= first && d <= today).map(([, v]) => v))
  return Array.from({ length: weeks }, (_, c) =>
    Array.from({ length: 7 }, (_, r) => {
      const date = addDays(first, c * 7 + r)
      const n = sets.get(date) ?? 0
      return { date, sets: n, level: (n > 0 ? Math.min(4, Math.ceil((n / max) * 4)) : 0) as HeatDay['level'], future: date > today }
    }),
  )
}

const EFFORT_BUCKETS = 6

/** Work sets per RIR 0, 1, 2, 3, 4, 5+ (RPE reads as 10 - RPE); null without any rating. */
export function effortDist(workouts: Workout[], from: ISODate | null, to: ISODate | null): number[] | null {
  const out = new Array<number>(EFFORT_BUCKETS).fill(0)
  let any = false
  for (const w of workouts) {
    if (!within(w, from, to)) continue
    for (const e of w.entries) {
      for (const s of e.sets) {
        if (!s.done || s.warmup) continue
        const rir = s.failure ? 0 : s.rir ?? (s.rpe != null ? 10 - s.rpe : null)
        if (rir == null) continue
        out[Math.min(EFFORT_BUCKETS - 1, Math.max(0, Math.round(rir)))]++
        any = true
      }
    }
  }
  return any ? out : null
}

export interface StrengthPoint {
  id: string
  t: Ms
  date: ISODate
  e1rm: number
  best: number
  pr: boolean
}

/** An assisted load helps the lifter, so it is not a strength number. */
const liftEntries = (w: Workout, exId: string): Entry[] => w.entries.filter(e => e.exId === exId && !e.target?.assisted)

export function strengthSeries(workouts: Workout[], exId: string, formula: OneRmFormula, from: ISODate | null = null): StrengthPoint[] {
  const out: StrengthPoint[] = []
  for (const w of sortByStart(workouts)) {
    if (from && w.date < from) continue
    const entries = liftEntries(w, exId)
    const v = bestE1rm(entries, formula)
    if (!(v > 0)) continue
    out.push({ id: w.id, t: w.start, date: w.date, e1rm: v, best: bestLoad(entries), pr: w.prs.includes(exId) || !!w.e1prs?.includes(exId) })
  }
  return out
}

/** Exercises with a logged work set, latest first. */
export function recentExercises(workouts: Workout[]): string[] {
  const seen = new Set<string>()
  for (const w of sortByStart(workouts).reverse()) for (const e of w.entries) if (e.sets.some(s => s.done && !s.warmup)) seen.add(e.exId)
  return [...seen]
}

export function nearestWeighIn(list: WeighIn[], date: ISODate): WeighIn | null {
  const at = parseIso(date).getTime()
  let best: WeighIn | null = null
  let gap = Infinity
  for (const b of list) {
    const g = Math.abs(parseIso(b.date).getTime() - at)
    if (g < gap) {
      gap = g
      best = b
    }
  }
  return best
}

export const bwPercent = (lift: number, bw: number) => (bw > 0 ? Math.round((lift / bw) * 100) : null)

export type Lift = 'squat' | 'deadlift' | 'bench' | 'ohp'

export const LIFT_IDS: Record<Lift, string[]> = {
  squat: ['Barbell_Squat', 'Barbell_Full_Squat', 'Wide_Stance_Barbell_Squat'],
  deadlift: ['Barbell_Deadlift', 'Sumo_Deadlift'],
  bench: ['Barbell_Bench_Press_-_Medium_Grip', 'Bench_Press_-_Powerlifting'],
  ohp: ['Standing_Military_Press', 'Barbell_Shoulder_Press', 'Seated_Barbell_Military_Press'],
}

/** Common coaching ratios, a rule of thumb and nothing stricter. */
export const LIFT_RATIOS: [Lift, Lift, number][] = [
  ['squat', 'deadlift', 0.85],
  ['bench', 'squat', 0.75],
  ['ohp', 'bench', 0.65],
]

export interface BalanceRow {
  a: Lift
  b: Lift
  ratio: number
  rule: number
}

/** Null until all four lifts have been logged. */
export function structuralBalance(workouts: Workout[], formula: OneRmFormula): { lifts: Record<Lift, number>; rows: BalanceRow[] } | null {
  const bestOf = (ids: string[]) => {
    let best = 0
    for (const w of workouts) for (const id of ids) best = Math.max(best, bestE1rm(liftEntries(w, id), formula))
    return best
  }
  const lifts = { squat: bestOf(LIFT_IDS.squat), deadlift: bestOf(LIFT_IDS.deadlift), bench: bestOf(LIFT_IDS.bench), ohp: bestOf(LIFT_IDS.ohp) }
  if (Object.values(lifts).some(v => !(v > 0))) return null
  return { lifts, rows: LIFT_RATIOS.map(([a, b, rule]) => ({ a, b, rule, ratio: Math.round((lifts[a] / lifts[b]) * 100) / 100 })) }
}

export interface MuscleStrength {
  now: number
  peak: number
  ratio: number
}

/**
 * Best e1RM of the exercises primarily training a muscle in the period,
 * against the lifter's own all-time peak for that muscle. Never a population norm.
 */
export function muscleStrength(workouts: Workout[], lookup: ExerciseLookup, formula: OneRmFormula, from: ISODate | null): Record<string, MuscleStrength> {
  const peak: Record<string, number> = {}
  const now: Record<string, number> = {}
  for (const w of workouts) {
    for (const e of w.entries) {
      if (e.target?.assisted) continue
      const info = lookup(e.exId)
      if (!info) continue
      let best = 0
      for (const s of e.sets) if (s.done && !s.warmup) best = Math.max(best, e1rm(s.w ?? 0, s.r ?? 0, formula, s.rir))
      if (!(best > 0)) continue
      for (const m of info.primary) {
        peak[m] = Math.max(peak[m] ?? 0, best)
        if (!from || w.date >= from) now[m] = Math.max(now[m] ?? 0, best)
      }
    }
  }
  const out: Record<string, MuscleStrength> = {}
  for (const [m, v] of Object.entries(now)) out[m] = { now: v, peak: peak[m], ratio: v / peak[m] }
  return out
}

import { e1rm } from './onerm'
import type { Entry, OneRmFormula, SetRow, Workout } from './types'
import { clean } from './units'

const isWork = (s: SetRow) => s.done && !s.warmup

/** Σ weight × reps over completed sets, drops included. Warm-ups only when asked. */
export function workoutVolume(entries: Entry[], warmups = false): number {
  let v = 0
  for (const e of entries) {
    for (const s of e.sets) {
      if (!s.done || (s.warmup && !warmups)) continue
      v += (s.w ?? 0) * (s.r ?? 0)
      for (const d of s.drops ?? []) v += d.w * d.r
    }
  }
  return clean(v)
}

export const setsDone = (entries: Entry[]) => entries.reduce((n, e) => n + e.sets.filter(isWork).length, 0)
export const setsTotal = (entries: Entry[]) => entries.reduce((n, e) => n + e.sets.filter(s => !s.warmup).length, 0)

/** All sessions of one exercise, oldest first. */
export function exerciseHistory(workouts: Workout[], exId: string, before?: number): Entry[] {
  const out: Entry[] = []
  for (const w of sortByStart(workouts)) {
    if (before != null && w.start >= before) continue
    for (const e of w.entries) if (e.exId === exId) out.push(w.noProg ? { ...e, noProg: true } : e)
  }
  return out
}

export const sortByStart = (ws: Workout[]) => [...ws].sort((a, b) => a.start - b.start)

export function bestLoad(entries: Entry[]): number {
  let best = 0
  for (const e of entries) for (const s of e.sets) if (isWork(s) && (s.r ?? 0) > 0) best = Math.max(best, s.w ?? 0)
  return best
}

export function bestE1rm(entries: Entry[], formula: OneRmFormula = 'epley'): number {
  let best = 0
  for (const e of entries) for (const s of e.sets) if (isWork(s)) best = Math.max(best, e1rm(s.w ?? 0, s.r ?? 0, formula, s.rir))
  return best
}

/** The set to show as "last time" / "best": heaviest work set of the session. */
export function topSet(e: Entry): SetRow | undefined {
  let top: SetRow | undefined
  for (const s of e.sets) if (isWork(s) && (!top || (s.w ?? 0) > (top.w ?? 0) || ((s.w ?? 0) === (top.w ?? 0) && (s.r ?? 0) > (top.r ?? 0)))) top = s
  return top
}

/**
 * Records set by a finished session against everything before it. A load PR wins;
 * without one an estimated-1RM record is reported separately. A first-ever
 * session sets no record — there is nothing to beat.
 */
export function detectRecords(entries: Entry[], prior: Workout[], formula: OneRmFormula = 'epley') {
  const prs: string[] = []
  const e1prs: string[] = []
  for (const e of entries) {
    if (e.target?.assisted) continue
    const past = prior.flatMap(w => w.entries.filter(x => x.exId === e.exId))
    if (!past.some(p => p.sets.some(isWork))) continue
    const now = bestLoad([e])
    if (now > 0 && now > bestLoad(past)) {
      if (!prs.includes(e.exId)) prs.push(e.exId)
    } else if (bestE1rm([e], formula) > bestE1rm(past, formula)) {
      if (!e1prs.includes(e.exId)) e1prs.push(e.exId)
    }
  }
  return { prs, e1prs }
}

/** Monday-based (or Sunday-based) week key: the ISO date of the week's first day. */
export function weekKey(d: Date, weekStart: 0 | 1 = 1): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const back = (x.getDay() - weekStart + 7) % 7
  x.setDate(x.getDate() - back)
  return isoDate(x)
}

export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, n: number): string {
  const d = parseIso(iso)
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

/** Consecutive weeks with at least one workout, counting back from this week (or last, if this one is still empty). */
export function weekStreak(workouts: Workout[], now = new Date(), weekStart: 0 | 1 = 1): number {
  const weeks = new Set(workouts.map(w => weekKey(parseIso(w.date), weekStart)))
  let key = weekKey(now, weekStart)
  if (!weeks.has(key)) key = addDays(key, -7)
  let n = 0
  while (weeks.has(key)) {
    n++
    key = addDays(key, -7)
  }
  return n
}

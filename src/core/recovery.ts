import { e1rm } from './onerm'
import { muscleWeights, type ExerciseLookup } from './muscles'
import type { SetRow, Workout } from './types'

const H = 3_600_000
const DAY = 24 * H

/** How fast fatigue fades, per muscle: small muscles in a day, big ones in two. */
export const HALF_LIFE_H: Record<string, number> = {
  shoulders: 24, biceps: 24, triceps: 24, forearms: 24, abdominals: 24, neck: 24,
  traps: 30, chest: 30, lats: 30, 'middle back': 30,
  'lower back': 48, glutes: 48, quadriceps: 48, hamstrings: 48, adductors: 48, abductors: 48, calves: 48,
}
const DEFAULT_HALF_LIFE_H = 30

export const READY_BELOW = 0.25
export const FATIGUED_ABOVE = 0.5
const SETS_PER_UNIT = 8
const MAX_SETS_PER_SESSION = 12
const WARMUP_WEIGHT = 0.3

/** How much one set fatigues: 1 near failure (RIR ≤ 3), 0.3 far from it (RIR ≥ 6). */
export function setEffect(rir: number): number {
  if (rir <= 3) return 1
  if (rir >= 6) return 0.3
  return 1 - ((rir - 3) / 3) * 0.7
}

/** RIR of an unrated set, guessed from how far the weight sits below the lifter's best e1RM. */
export function estimateRir(s: SetRow, best: number): number {
  const w = s.w ?? 0
  const r = s.r ?? 0
  if (!(w > 0) || !(best > 0)) return 2
  return Math.min(10, Math.max(0, 30 * (best / w - 1) - r))
}

export type RecoveryLabel = 'ready' | 'recovering' | 'fatigued'

export const labelOf = (f: number): RecoveryLabel => (f < READY_BELOW ? 'ready' : f <= FATIGUED_ABOVE ? 'recovering' : 'fatigued')

/**
 * Fatigue 0..1 per muscle at `now`. Each session adds a stimulus
 * (effective sets / 8, scaled by how unusual the week's volume is for this
 * lifter), and each stimulus decays with the muscle's half-life.
 */
export function fatigue(workouts: Workout[], lookup: ExerciseLookup, now = Date.now()): Record<string, number> {
  const recent = workouts.filter(w => w.end <= now && now - w.end < 28 * DAY)
  const bestByEx = new Map<string, number>()
  for (const w of workouts) {
    if (now - w.end > 90 * DAY) continue
    for (const e of w.entries) for (const s of e.sets) if (s.done && !s.warmup) bestByEx.set(e.exId, Math.max(bestByEx.get(e.exId) ?? 0, e1rm(s.w ?? 0, s.r ?? 0)))
  }

  // effective sets per muscle per workout
  const perWorkout = recent.map(w => {
    const eff: Record<string, number> = {}
    for (const e of w.entries) {
      const info = lookup(e.exId)
      if (!info) continue
      let sets = 0
      for (const s of e.sets) {
        if (!s.done) continue
        if (s.warmup) sets += WARMUP_WEIGHT
        else sets += setEffect(s.failure ? 0 : s.rir ?? (s.rpe != null ? 10 - s.rpe : estimateRir(s, bestByEx.get(e.exId) ?? 0)))
      }
      for (const [m, k] of Object.entries(muscleWeights(info))) eff[m] = (eff[m] ?? 0) + sets * k
    }
    return { at: w.end, eff }
  })

  const sum = (from: number) => {
    const t: Record<string, number> = {}
    for (const p of perWorkout) if (now - p.at < from) for (const [m, v] of Object.entries(p.eff)) t[m] = (t[m] ?? 0) + v
    return t
  }
  const acute = sum(7 * DAY)
  const chronic = sum(28 * DAY)

  const load: Record<string, number> = {}
  for (const p of perWorkout) {
    for (const [m, sets] of Object.entries(p.eff)) {
      const gain = Math.min(2, Math.max(0.5, ((acute[m] ?? 0) + 4) / ((chronic[m] ?? 0) / 4 + 4)))
      const stimulus = (Math.min(sets, MAX_SETS_PER_SESSION) / SETS_PER_UNIT) * gain
      const half = (HALF_LIFE_H[m] ?? DEFAULT_HALF_LIFE_H) * H
      load[m] = (load[m] ?? 0) + stimulus * 0.5 ** ((now - p.at) / half)
    }
  }
  const out: Record<string, number> = {}
  for (const [m, v] of Object.entries(load)) out[m] = 1 - Math.exp(-v)
  return out
}

/** Muscles with no completed work set in the last `days` days. */
export function untrained(workouts: Workout[], lookup: ExerciseLookup, all: readonly string[], days = 14, now = Date.now()) {
  const hit = new Set<string>()
  for (const w of workouts) {
    if (now - w.end > days * DAY) continue
    for (const e of w.entries) {
      const info = lookup(e.exId)
      if (info && e.sets.some(s => s.done && !s.warmup)) for (const m of info.primary) hit.add(m)
    }
  }
  return all.filter(m => !hit.has(m))
}

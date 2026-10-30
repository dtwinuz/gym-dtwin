import type { Workout } from './types'

/** Muscle vocabulary of the catalogue (free-exercise-db). */
export const MUSCLES = [
  'chest', 'shoulders', 'triceps', 'biceps', 'forearms', 'neck', 'traps', 'lats', 'middle back', 'lower back',
  'abdominals', 'glutes', 'quadriceps', 'hamstrings', 'adductors', 'abductors', 'calves',
] as const
export type Muscle = (typeof MUSCLES)[number]

export const SECONDARY_WEIGHT = 0.4

export interface MuscleInfo {
  primary: string[]
  secondary: string[]
  /** Explicit 0..1 weights, when the plain primary/secondary split draws it wrong. */
  weights?: Record<string, number>
}

export function muscleWeights(ex: MuscleInfo): Record<string, number> {
  if (ex.weights) return ex.weights
  const out: Record<string, number> = {}
  for (const m of ex.secondary) out[m] = SECONDARY_WEIGHT
  for (const m of ex.primary) out[m] = 1
  return out
}

export type ExerciseLookup = (exId: string) => MuscleInfo | undefined

/** Σ weight × completed work sets per muscle, over workouts on or after `fromIso`. */
export function muscleLoad(workouts: Workout[], lookup: ExerciseLookup, fromIso?: string, toIso?: string) {
  const load: Record<string, number> = {}
  for (const w of workouts) {
    if (fromIso && w.date < fromIso) continue
    if (toIso && w.date > toIso) continue
    for (const e of w.entries) {
      const info = lookup(e.exId)
      if (!info) continue
      const sets = e.sets.filter(s => s.done && !s.warmup).length
      if (!sets) continue
      for (const [m, k] of Object.entries(muscleWeights(info))) load[m] = (load[m] ?? 0) + k * sets
    }
  }
  return load
}

/** 0..4 shade level per muscle, relative to the busiest one. */
export function loadLevels(load: Record<string, number>): Record<string, number> {
  const max = Math.max(0, ...Object.values(load))
  const out: Record<string, number> = {}
  for (const [m, v] of Object.entries(load)) out[m] = max > 0 && v > 0 ? Math.min(4, Math.ceil((v / max) * 4)) : 0
  return out
}

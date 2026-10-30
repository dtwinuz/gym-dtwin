import type { OneRmFormula } from './types'

type Formula = (w: number, r: number) => number

export const FORMULAS: Record<OneRmFormula, Formula> = {
  epley: (w, r) => w * (1 + r / 30),
  brzycki: (w, r) => (36 * w) / (37 - r),
  lombardi: (w, r) => w * r ** 0.1,
  oconner: (w, r) => w * (1 + r / 40),
  mayhew: (w, r) => (100 * w) / (52.2 + 41.9 * Math.exp(-0.055 * r)),
  wathan: (w, r) => (100 * w) / (48.8 + 53.8 * Math.exp(-0.075 * r)),
  lander: (w, r) => (100 * w) / (101.3 - 2.67123 * r),
}

/** Share of 1RM a set of n reps to failure represents (n = 1..15). */
export const PCT_OF_1RM = [100, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 71.7, 69.5, 67.5, 65.5, 63.6]

/** Above this many reps the estimate is too noisy to be a strength number. */
export const REP_CAP = 12

/**
 * Estimated 1RM. Reps in reserve count as reps the set could still have done,
 * so 100 kg × 5 @ RIR 2 is read as 100 kg × 7 to failure.
 */
export function e1rm(w: number, r: number, formula: OneRmFormula = 'epley', rir = 0) {
  if (!(w > 0) || !(r > 0)) return 0
  const reps = Math.min(r + Math.max(0, rir), REP_CAP)
  if (reps <= 1) return w
  return Math.round(FORMULAS[formula](w, reps) * 10) / 10
}

/** Weight for `reps` reps given a 1RM, from the %1RM table (Epley past 15). */
export function weightForReps(oneRm: number, reps: number) {
  if (reps <= 1) return oneRm
  const pct = reps <= PCT_OF_1RM.length ? PCT_OF_1RM[reps - 1] : 100 / (1 + reps / 30)
  return (oneRm * pct) / 100
}

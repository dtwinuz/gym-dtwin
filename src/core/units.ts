import type { Unit } from './types'

export const LB_PER_KG = 2.2046226218

export const kgToLb = (kg: number) => kg * LB_PER_KG
export const lbToKg = (lb: number) => lb / LB_PER_KG

export function convert(w: number, from: Unit, to: Unit) {
  if (from === to) return w
  return from === 'kg' ? kgToLb(w) : lbToKg(w)
}

/** Smallest lift step a unit is rounded to: 0.25 kg / 0.5 lb. */
export const liftStep = (unit: Unit) => (unit === 'kg' ? 0.25 : 0.5)

export const round = (v: number, step: number) => Math.round(v / step) * step
export const floorTo = (v: number, step: number) => Math.floor(v / step + 1e-9) * step
export const ceilTo = (v: number, step: number) => Math.ceil(v / step - 1e-9) * step

/** Round a converted lift to its unit's grid, cleaned of float noise. */
export const roundLift = (w: number, unit: Unit) => clean(round(w, liftStep(unit)))
export const roundBody = (w: number) => clean(round(w, 0.1))

export const clean = (v: number) => Math.round(v * 1e6) / 1e6

/** Default progression increment: legs/back move 5 kg (10 lb), the rest 2.5 kg (5 lb). */
const HEAVY_PARTS = new Set(['quadriceps', 'hamstrings', 'glutes', 'lower back', 'middle back', 'lats', 'adductors', 'abductors'])

export function defaultIncrement(unit: Unit, primaryMuscle?: string) {
  const heavy = primaryMuscle ? HEAVY_PARTS.has(primaryMuscle) : false
  if (unit === 'kg') return heavy ? 5 : 2.5
  return heavy ? 10 : 5
}

/** 1 → one decimal (82.5), 2 → up to two (82.25); trailing zeros dropped. */
export function formatWeight(w: number, wdec: 1 | 2 = 1) {
  return String(Number(clean(w).toFixed(wdec)))
}

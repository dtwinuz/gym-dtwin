import type { Unit } from './types'
import { clean } from './units'

export const PLATE_SIZES: Record<Unit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 2, 1.5, 1.25, 1, 0.5],
  lb: [45, 35, 25, 15, 10, 5, 2.5, 1.25, 1, 0.5],
}
/** Sizes a typical gym has; the odd ones start switched off. */
export const COMMON_PLATES: Record<Unit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
}
export const DEFAULT_PAIRS = 6

export const BAR_DEFAULTS: Record<string, Record<Unit, number>> = {
  barbell: { kg: 20, lb: 45 },
  'e-z curl bar': { kg: 10, lb: 25 },
  smith: { kg: 9, lb: 20 },
  'trap bar': { kg: 25, lb: 55 },
}

export function defaultPlates(unit: Unit): Record<number, number> {
  return Object.fromEntries(COMMON_PLATES[unit].map(s => [s, DEFAULT_PAIRS]))
}

export interface PlateLoad {
  /** Plates on one side, heaviest first. */
  perSide: number[]
  /** Total weight actually loaded (bar included). */
  loaded: number
  /** How far below the target the loaded weight is (0 when exact). */
  short: number
}

/** Weight is solved in quarter units so 1.25 and 0.5 plates stay exact integers. */
const Q = 4

/**
 * Fewest plates per side that load `target` on `bar`, from the owned pairs.
 * When the exact weight cannot be made, the closest weight below it.
 */
export function solvePlates(target: number, bar: number, pairs: Record<number, number>): PlateLoad {
  const want = Math.round(((target - bar) / 2) * Q)
  if (want <= 0) return { perSide: [], loaded: bar, short: clean(Math.max(0, target - bar)) }

  const items: number[] = []
  for (const [size, n] of Object.entries(pairs)) {
    const s = Math.round(Number(size) * Q)
    if (s > 0) for (let i = 0; i < n; i++) items.push(s)
  }
  items.sort((a, b) => b - a)

  // 0/1 knapsack: best[v] = fewest plates summing to v; keep[i][v] = item i improved v
  const INF = Number.MAX_SAFE_INTEGER
  const best = new Array<number>(want + 1).fill(INF)
  const keep = items.map(() => new Uint8Array(want + 1))
  best[0] = 0
  for (let i = 0; i < items.length; i++) {
    const s = items[i]
    for (let v = want; v >= s; v--) {
      if (best[v - s] !== INF && best[v - s] + 1 < best[v]) {
        best[v] = best[v - s] + 1
        keep[i][v] = 1
      }
    }
  }
  let cur = want
  while (cur > 0 && best[cur] === INF) cur--
  const perSide: number[] = []
  for (let i = items.length - 1; i >= 0 && cur > 0; i--) {
    if (keep[i][cur]) {
      perSide.push(items[i] / Q)
      cur -= items[i]
    }
  }
  perSide.sort((a, b) => b - a)
  const side = perSide.reduce((a, b) => a + b, 0)
  const loaded = clean(bar + side * 2)
  return { perSide, loaded, short: clean(Math.max(0, target - loaded)) }
}

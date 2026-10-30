import { clean, floorTo } from './units'

export const MAX_WARMUPS = 5
const WARMUP_REPS = [8, 5, 3, 2, 1]

export interface WarmupSet {
  w: number
  r: number
}

/**
 * Warm-up ramp toward a work weight. Each rung closes half the remaining gap
 * (50 %, 75 %, 87.5 % …), rounded down to the step, never below the bar and
 * never at or above the work weight. Rungs that round together are merged.
 */
export function warmupRamp(work: number, count: number, step: number, bar = 0): WarmupSet[] {
  const n = Math.min(Math.max(0, Math.floor(count)), MAX_WARMUPS)
  const out: WarmupSet[] = []
  if (n === 0 || !(work > 0)) return out
  for (let k = 1; k <= n; k++) {
    let w = floorTo(work * (1 - 0.5 ** k), step)
    w = clean(Math.max(bar, w))
    if (w >= work) break
    if (out.length && out[out.length - 1].w === w) continue
    out.push({ w, r: WARMUP_REPS[k - 1] })
  }
  return out
}

const DAY = 86_400_000

/** Maps a domain onto a range; a flat domain maps to the middle of the range. */
export function linear(d0: number, d1: number, r0: number, r1: number) {
  if (d0 === d1) return () => (r0 + r1) / 2
  return (v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)
}

/** Round axis values covering min..max, about `count` of them. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1
    return niceTicks(min - pad, max + pad, count)
  }
  const raw = (max - min) / Math.max(1, count)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag
  const out: number[] = []
  const first = Math.floor(min / step + 1e-9)
  const last = Math.ceil(max / step - 1e-9)
  for (let i = first; i <= last; i++) out.push(Math.round(i * step * 1e6) / 1e6)
  return out
}

/** Time axis ticks: month starts on long spans, evenly spaced days on short ones. */
export function timeTicks(from: number, to: number, count = 4): number[] {
  if (to <= from) return [from]
  const days = (to - from) / DAY
  if (days <= 62) {
    const step = Math.max(1, Math.ceil(days / count))
    const out: number[] = []
    const start = new Date(from)
    start.setHours(0, 0, 0, 0)
    for (let d = new Date(start); d.getTime() <= to; d.setDate(d.getDate() + step)) if (d.getTime() >= from) out.push(d.getTime())
    return out
  }
  const months = Math.ceil(days / 30.44)
  const step = Math.max(1, Math.ceil(months / count))
  const out: number[] = []
  const d = new Date(from)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  d.setMonth(d.getMonth() + 1)
  for (; d.getTime() <= to; d.setMonth(d.getMonth() + step)) out.push(d.getTime())
  return out
}

/** Index of the value closest to x in an ascending list. */
export function nearestIndex(xs: number[], x: number): number {
  if (xs.length === 0) return -1
  let lo = 0
  let hi = xs.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (xs[mid] <= x) lo = mid
    else hi = mid
  }
  return Math.abs(xs[hi] - x) < Math.abs(xs[lo] - x) ? hi : lo
}

export function linePath(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')
}

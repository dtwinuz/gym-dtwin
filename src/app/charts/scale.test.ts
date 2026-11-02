import { describe, expect, it } from 'vitest'
import { linePath, linear, nearestIndex, niceTicks, timeTicks } from './scale'

describe('chart scales', () => {
  it('linear maps the domain and centres a flat one', () => {
    const s = linear(0, 10, 100, 200)
    expect(s(0)).toBe(100)
    expect(s(5)).toBe(150)
    expect(s(10)).toBe(200)
    expect(linear(5, 5, 0, 100)(5)).toBe(50)
    const inverted = linear(0, 10, 100, 0)
    expect(inverted(10)).toBe(0)
  })

  it('niceTicks cover the range with round steps', () => {
    expect(niceTicks(0, 100, 4)).toEqual([0, 25, 50, 75, 100])
    const t = niceTicks(62.5, 81, 4)
    expect(t[0]).toBeLessThanOrEqual(62.5)
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(81)
    expect(t[1] - t[0]).toBe(5)
  })

  it('niceTicks survive a flat or broken range', () => {
    const flat = niceTicks(80, 80)
    expect(flat.length).toBeGreaterThan(1)
    expect(flat[0]).toBeLessThanOrEqual(80)
    expect(flat[flat.length - 1]).toBeGreaterThanOrEqual(80)
    expect(niceTicks(NaN, 3)).toEqual([])
  })

  it('timeTicks use month starts on long spans and stay inside the range', () => {
    const from = new Date(2026, 0, 15).getTime()
    const to = new Date(2026, 11, 20).getTime()
    const ticks = timeTicks(from, to, 4)
    expect(ticks.length).toBeGreaterThan(1)
    expect(ticks.every(t => t >= from && t <= to && new Date(t).getDate() === 1)).toBe(true)
    const short = timeTicks(new Date(2026, 0, 1).getTime(), new Date(2026, 0, 21).getTime(), 4)
    expect(short.length).toBeGreaterThanOrEqual(4)
    expect(timeTicks(5, 5)).toEqual([5])
  })

  it('nearestIndex finds the closest point', () => {
    const xs = [10, 20, 40]
    expect(nearestIndex(xs, 0)).toBe(0)
    expect(nearestIndex(xs, 14)).toBe(0)
    expect(nearestIndex(xs, 16)).toBe(1)
    expect(nearestIndex(xs, 99)).toBe(2)
    expect(nearestIndex([], 1)).toBe(-1)
  })

  it('linePath draws in order', () => {
    expect(linePath([[0, 1], [2, 3]])).toBe('M0.0 1.0L2.0 3.0')
  })
})

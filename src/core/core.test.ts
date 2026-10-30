import { describe, expect, it } from 'vitest'
import { detectRecords, weekStreak, workoutVolume } from './history'
import { muscleLoad, loadLevels } from './muscles'
import { e1rm, weightForReps } from './onerm'
import { solvePlates } from './plates'
import { nextPrescription, policyOf, readSession, stallCount } from './progression'
import { fatigue, labelOf, setEffect } from './recovery'
import { REST, rotationForDay, rotationState } from './schedule'
import type { Entry, Rx, SetRow, Slot, Workout } from './types'
import { convert, formatWeight, roundLift } from './units'
import { warmupRamp } from './warmup'

const sets = (w: number, reps: number[]): SetRow[] => reps.map(r => ({ w, r, done: true }))
const entry = (slot: Slot, w: number, reps: number[], rx?: Rx): Entry => ({ exId: slot.exId, target: slot, rx, sets: sets(w, reps) })
const slot = (o: Partial<Slot> = {}): Slot => ({ exId: 'bench', sets: 3, reps: 5, weight: 60, ...o })

let n = 0
const workout = (date: string, entries: Entry[], routineIds: string[] = [], hour = 18): Workout => {
  const start = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime()
  return { id: `w${++n}`, date, start, end: start + 3_600_000, routineIds, name: '', entries, prs: [], vol: 0, updatedAt: start }
}

describe('units', () => {
  it('converts and rounds to the lift grid', () => {
    expect(roundLift(convert(100, 'kg', 'lb'), 'lb')).toBe(220.5)
    expect(roundLift(convert(225, 'lb', 'kg'), 'kg')).toBe(102)
    expect(formatWeight(82.5)).toBe('82.5')
    expect(formatWeight(82.25, 2)).toBe('82.25')
    expect(formatWeight(80)).toBe('80')
  })
})

describe('1RM', () => {
  it('epley, single rep and RIR', () => {
    expect(e1rm(100, 5)).toBe(116.7)
    expect(e1rm(100, 1)).toBe(100)
    expect(e1rm(100, 5, 'epley', 2)).toBe(e1rm(100, 7))
    expect(e1rm(0, 5)).toBe(0)
    expect(e1rm(100, 30)).toBe(e1rm(100, 12))
  })
  it('weight for reps follows the %1RM table', () => {
    expect(weightForReps(100, 1)).toBe(100)
    expect(weightForReps(100, 5)).toBeCloseTo(86.3)
  })
})

describe('progression', () => {
  it('first session uses the routine numbers', () => {
    expect(nextPrescription({ slot: slot(), history: [], policy: 'linear', inc: 2.5 })).toMatchObject({ weight: 60, reps: 5, why: 'first' })
  })
  it('linear adds load after a full session, holds after a miss', () => {
    const s = slot()
    expect(nextPrescription({ slot: s, history: [entry(s, 60, [5, 5, 5])], policy: 'linear', inc: 2.5 })).toMatchObject({ weight: 62.5, why: 'load' })
    expect(nextPrescription({ slot: s, history: [entry(s, 60, [5, 5, 4])], policy: 'linear', inc: 2.5 })).toMatchObject({ weight: 60, why: 'hold' })
  })
  it('three misses at one weight deload ~10 %', () => {
    const s = slot()
    const miss = () => entry(s, 100, [5, 4, 3])
    expect(stallCount([miss(), miss(), miss()], s)).toBe(3)
    expect(nextPrescription({ slot: s, history: [miss(), miss(), miss()], policy: 'linear', inc: 2.5 })).toMatchObject({ weight: 90, why: 'deload' })
  })
  it('a weight change or success ends a stall run', () => {
    const s = slot()
    expect(stallCount([entry(s, 97.5, [5, 4, 3]), entry(s, 100, [5, 4, 3]), entry(s, 100, [5, 4, 3])], s)).toBe(2)
    expect(stallCount([entry(s, 100, [5, 4, 3]), entry(s, 100, [5, 5, 5]), entry(s, 100, [5, 4, 3])], s)).toBe(1)
  })
  it('greyskull doubles the jump on a big AMRAP', () => {
    const s = slot()
    const h = [entry(s, 60, [5, 5, 10], { sets: 3, reps: 5, weight: 60 })]
    expect(nextPrescription({ slot: s, history: h, policy: 'greyskull', inc: 2.5 }).weight).toBe(65)
  })
  it('double progression climbs reps through the range, then load', () => {
    const s = slot({ reps: 12, repsMin: 8 })
    const first = nextPrescription({ slot: s, history: [], policy: 'double', inc: 2.5 })
    expect(first.reps).toBe(8)
    const mid = nextPrescription({ slot: s, history: [entry(s, 60, [9, 9, 9], { sets: 3, reps: 8, weight: 60 })], policy: 'double', inc: 2.5 })
    expect(mid).toMatchObject({ reps: 10, weight: 60, why: 'reps' })
    const top = nextPrescription({ slot: s, history: [entry(s, 60, [12, 12, 12], { sets: 3, reps: 12, weight: 60 })], policy: 'double', inc: 2.5 })
    expect(top).toMatchObject({ reps: 8, weight: 62.5, why: 'load' })
  })
  it('triple progression: reps, then sets, then load', () => {
    const s = slot({ sets: 3, reps: 6, repsMin: 5, setsMax: 4 })
    const r1 = nextPrescription({ slot: s, history: [entry(s, 80, [5, 5, 5], { sets: 3, reps: 5, weight: 80 })], policy: 'triple', inc: 2.5 })
    expect(r1).toMatchObject({ reps: 6, sets: 3, why: 'reps' })
    const r2 = nextPrescription({ slot: s, history: [entry(s, 80, [6, 6, 6], { sets: 3, reps: 6, weight: 80 })], policy: 'triple', inc: 2.5 })
    expect(r2).toMatchObject({ reps: 6, sets: 4, why: 'set' })
    const r3 = nextPrescription({ slot: s, history: [entry(s, 80, [6, 6, 6, 6], { sets: 4, reps: 6, weight: 80 })], policy: 'triple', inc: 2.5 })
    expect(r3).toMatchObject({ reps: 5, sets: 3, weight: 82.5, why: 'load' })
  })
  it('bodyweight adds reps, then a set at the ceiling', () => {
    const s = slot({ exId: 'pullup', bodyweight: true, weight: 0, reps: 10, repsMin: 6 })
    expect(nextPrescription({ slot: s, history: [entry(s, 0, [8, 8, 8], { sets: 3, reps: 8, weight: 0 })], policy: 'linear', inc: 2.5 })).toMatchObject({ reps: 9, why: 'reps' })
    expect(nextPrescription({ slot: s, history: [entry(s, 0, [10, 10, 10], { sets: 3, reps: 10, weight: 0 })], policy: 'linear', inc: 2.5 })).toMatchObject({ sets: 4, reps: 6, why: 'set' })
  })
  it('timed holds add seconds', () => {
    const s = slot({ exId: 'plank', mode: 'time', sec: 45, reps: 0, weight: 0 })
    const e: Entry = { exId: 'plank', target: s, rx: { sets: 3, reps: 0, weight: 0, sec: 45 }, sets: [45, 50, 45].map(sec => ({ sec, done: true })) }
    expect(policyOf(s)).toBe('time')
    expect(nextPrescription({ slot: s, history: [e], policy: 'time', inc: 0 })).toMatchObject({ sec: 50, why: 'time' })
  })
  it('a changed plan holds the weight with new targets', () => {
    const old = slot({ reps: 5 })
    expect(nextPrescription({ slot: slot({ reps: 8 }), history: [entry(old, 70, [5, 5, 5])], policy: 'linear', inc: 2.5 })).toMatchObject({ weight: 70, reps: 8, why: 'plan' })
  })
  it('assisted machines progress by lowering the assistance', () => {
    const s = slot({ exId: 'assisted-dip', assisted: true, weight: 30 })
    expect(nextPrescription({ slot: s, history: [entry(s, 30, [5, 5, 5])], policy: 'linear', inc: 5 }).weight).toBe(25)
  })
  it('warm-ups never count when judging', () => {
    const s = slot()
    const e = entry(s, 60, [5, 5, 5])
    e.sets.unshift({ w: 20, r: 2, done: true, warmup: true })
    expect(readSession(e)?.ok).toBe(true)
  })
  it('pyramid slots never progress', () => {
    expect(policyOf(slot({ pyramid: [12, 10, 8] }), 'linear')).toBe('off')
  })
})

describe('warm-ups', () => {
  it('ramps by halving the gap, rounded down, above the bar', () => {
    expect(warmupRamp(100, 3, 2.5, 20).map(s => s.w)).toEqual([50, 75, 87.5])
    expect(warmupRamp(30, 3, 2.5, 20).map(s => s.w)).toEqual([20, 22.5, 25])
    expect(warmupRamp(20, 3, 2.5, 20)).toEqual([])
  })
})

describe('plates', () => {
  const gym = { 25: 4, 20: 2, 10: 2, 5: 2, 2.5: 2, 1.25: 2 }
  it('loads exact weights with the fewest plates', () => {
    expect(solvePlates(100, 20, gym)).toEqual({ perSide: [20, 20], loaded: 100, short: 0 })
    expect(solvePlates(100, 20, { 25: 4, 10: 2, 5: 2 }).perSide).toEqual([25, 10, 5])
    expect(solvePlates(62.5, 20, gym).perSide).toEqual([20, 1.25])
    expect(solvePlates(20, 20, gym)).toEqual({ perSide: [], loaded: 20, short: 0 })
  })
  it('falls back to the closest weight below', () => {
    expect(solvePlates(61, 20, gym)).toMatchObject({ loaded: 60, short: 1 })
    expect(solvePlates(300, 20, { 20: 1 })).toMatchObject({ loaded: 60, short: 240 })
  })
})

describe('history', () => {
  it('volume skips warm-ups and adds drops', () => {
    const e: Entry = { exId: 'x', sets: [{ w: 20, r: 10, done: true, warmup: true }, { w: 100, r: 5, done: true, drops: [{ w: 80, r: 5 }] }, { w: 100, r: 5, done: false }] }
    expect(workoutVolume([e])).toBe(900)
    expect(workoutVolume([e], true)).toBe(1100)
  })
  it('records: load PR beats e1RM record, first session sets none', () => {
    const s = slot()
    const past = [workout('2026-10-01', [entry(s, 100, [5])])]
    expect(detectRecords([entry(s, 102.5, [3])], past).prs).toEqual(['bench'])
    expect(detectRecords([entry(s, 100, [7])], past)).toEqual({ prs: [], e1prs: ['bench'] })
    expect(detectRecords([entry(s, 100, [5])], [])).toEqual({ prs: [], e1prs: [] })
  })
  it('week streak counts back from last week when this one is empty', () => {
    const ws = [workout('2026-10-13', []), workout('2026-10-20', []), workout('2026-10-21', [])]
    expect(weekStreak(ws, new Date('2026-10-28T12:00:00'))).toBe(2)
    expect(weekStreak(ws, new Date('2026-11-10T12:00:00'))).toBe(0)
  })
})

describe('muscles & recovery', () => {
  const lookup = (id: string) => (id === 'bench' ? { primary: ['chest'], secondary: ['triceps', 'shoulders'] } : undefined)
  it('weights primaries 1 and secondaries 0.4', () => {
    const load = muscleLoad([workout('2026-10-20', [entry(slot(), 60, [5, 5, 5])])], lookup)
    expect(load).toEqual({ chest: 3, triceps: 1.2000000000000002, shoulders: 1.2000000000000002 })
    expect(loadLevels(load)).toEqual({ chest: 4, triceps: 2, shoulders: 2 })
  })
  it('set effect is 1 near failure, 0.3 far from it', () => {
    expect(setEffect(2)).toBe(1)
    expect(setEffect(6)).toBe(0.3)
    expect(setEffect(4.5)).toBeCloseTo(0.65)
  })
  it('fatigue is high right after and fades with time', () => {
    const w = workout('2026-10-20', [{ exId: 'bench', sets: Array.from({ length: 8 }, () => ({ w: 100, r: 5, rir: 1, done: true })) }])
    const right = fatigue([w], lookup, w.end + 1000).chest
    const later = fatigue([w], lookup, w.end + 4 * 86_400_000).chest
    expect(labelOf(right)).toBe('fatigued')
    expect(later).toBeLessThan(right / 4)
    expect(labelOf(later)).toBe('ready')
  })
})

describe('rotation', () => {
  const rot = { id: 'r', sequence: ['A', 'B', REST, 'C'], since: 0 }
  it('advances only on the routine that is up next', () => {
    expect(rotationState(rot, []).next).toBe(0)
    expect(rotationState(rot, [workout('2026-10-20', [], ['A'])]).next).toBe(1)
    expect(rotationState(rot, [workout('2026-10-20', [], ['A']), workout('2026-10-21', [], ['C'])]).next).toBe(1)
  })
  it('rest entries hold the next routine back a day', () => {
    const ws = [workout('2026-10-20', [], ['A']), workout('2026-10-21', [], ['B'])]
    expect(rotationForDay(rot, ws, '2026-10-22')).toBe(REST)
    expect(rotationForDay(rot, ws, '2026-10-23')).toBe('C')
  })
  it('wraps around', () => {
    const ws = ['A', 'B', 'C'].map((id, i) => workout(`2026-10-2${i}`, [], [id]))
    expect(rotationForDay(rot, ws, '2026-10-24')).toBe('A')
  })
})

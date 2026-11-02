import { describe, expect, it } from 'vitest'
import type { Profile, SetRow, Workout } from '../core/types'
import { emptyProfile } from './profile'
import { addRow, blankWorkout, cleanEntries, deleteWorkout, newEntry, patchRow, recomputeRecords, repeatSession, saveWorkout, swapEntry, timeOf, workoutTimes } from './records'

const NOW = new Date('2026-11-02T10:00:00').getTime()
const DAY = 86_400_000
const set = (w: number, r: number, extra: Partial<SetRow> = {}): SetRow => ({ w, r, done: true, ...extra })

function workout(id: string, daysAgo: number, sets: SetRow[], exId = 'bench', extra: Partial<Workout> = {}): Workout {
  const start = NOW - daysAgo * DAY
  const date = new Date(start).toISOString().slice(0, 10)
  return { id, date, start, end: start + 3_600_000, routineIds: [], name: id, entries: [{ exId, sets }], prs: [], vol: sets.reduce((v, s) => v + (s.w ?? 0) * (s.r ?? 0), 0), updatedAt: 1, ...extra }
}

function profile(workouts: Workout[]): Profile {
  return { ...emptyProfile(NOW, 'en'), workouts }
}

const byId = (p: Profile, id: string) => {
  const w = p.workouts.find(x => x.id === id)
  if (!w) throw new Error(id)
  return w
}

describe('recomputeRecords', () => {
  const base = () => [
    workout('a', 30, [set(100, 5)]),
    workout('b', 20, [set(110, 5)], 'bench', { prs: ['bench'] }),
    workout('c', 10, [set(120, 5)], 'bench', { prs: ['bench'] }),
  ]

  it('leaves a correct history untouched, by identity', () => {
    const list = base()
    expect(recomputeRecords(list, emptyProfile().settings, -Infinity, NOW)).toBe(list)
  })

  it('takes a record away from a later workout when an earlier one beats it', () => {
    const list = base()
    list[0] = { ...list[0], entries: [{ exId: 'bench', sets: [set(115, 5)] }] }
    const out = recomputeRecords(list, emptyProfile().settings, list[0].start, NOW)
    expect(out.find(w => w.id === 'b')?.prs).toEqual([])
    expect(out.find(w => w.id === 'c')?.prs).toEqual(['bench'])
    expect(out.find(w => w.id === 'a')?.vol).toBe(575)
    expect(out.find(w => w.id === 'b')?.updatedAt).toBe(NOW)
    expect(out.find(w => w.id === 'c')).toBe(list[2])
  })

  it('does not touch workouts before the starting point', () => {
    const list = base()
    const wrong = { ...list[1], prs: [] }
    const out = recomputeRecords([list[0], wrong, list[2]], emptyProfile().settings, list[2].start, NOW)
    expect(out[1]).toBe(wrong)
  })

  it('respects the formula and the warm-up volume setting', () => {
    const list = [workout('a', 3, [set(50, 5, { warmup: true }), set(100, 5)])]
    const calc = { ...emptyProfile().settings, volumeWarmups: true }
    expect(recomputeRecords(list, calc, -Infinity, NOW)[0].vol).toBe(750)
  })
})

describe('saving and deleting', () => {
  it('moving a workout earlier recomputes those it now precedes', () => {
    const a = workout('a', 30, [set(100, 5)])
    const b = workout('b', 20, [set(110, 5)], 'bench', { prs: ['bench'] })
    const big = workout('big', 10, [set(130, 5)], 'bench', { prs: ['bench'] })
    const p = profile([a, b, big])
    const moved = { ...big, start: NOW - 25 * DAY, end: NOW - 25 * DAY + 60000 }
    const next = saveWorkout(p, moved, NOW)
    expect(byId(next, 'big').prs).toEqual(['bench'])
    expect(byId(next, 'b').prs).toEqual([])
    expect(next.deleted).toEqual({})
  })

  it('an edit changes volume, the later record and the last good weight', () => {
    const a = workout('a', 30, [set(100, 5)])
    const b = workout('b', 20, [set(110, 5)], 'bench', { prs: ['bench'] })
    const p = { ...profile([a, b]), exWeights: { bench: { w: 110, date: b.date } } }
    const fixed = { ...b, entries: [{ exId: 'bench', sets: [set(90, 5)] }] }
    const next = saveWorkout(p, fixed, NOW)
    expect(byId(next, 'b')).toMatchObject({ vol: 450, prs: [], updatedAt: NOW })
    expect(next.exWeights.bench).toEqual({ w: 90, date: b.date })
  })

  it('saving does not end a running session', () => {
    const p = { ...profile([]), active: { id: 's', date: '2026-11-02', start: NOW, routineIds: [], name: 'x', entries: [], cur: 0 } }
    expect(saveWorkout(p, workout('a', 3, [set(100, 5)]), NOW).active?.id).toBe('s')
  })

  it('delete leaves a tombstone and promotes the next record; undo restores all', () => {
    const a = workout('a', 30, [set(100, 5)])
    const b = workout('b', 20, [set(120, 5)], 'bench', { prs: ['bench'] })
    const c = workout('c', 10, [set(110, 5)], 'bench', { prs: [], e1prs: [] })
    const p = profile([a, b, c])
    const gone = deleteWorkout(p, 'b', NOW)
    expect(gone.workouts.map(w => w.id)).toEqual(['a', 'c'])
    expect(gone.deleted.workouts.b).toBe(NOW)
    expect(byId(gone, 'c').prs).toEqual(['bench'])
    const back = saveWorkout(gone, b, NOW + 1)
    expect(back.deleted.workouts.b).toBeUndefined()
    expect(byId(back, 'b').prs).toEqual(['bench'])
    expect(byId(back, 'c').prs).toEqual([])
    expect(deleteWorkout(p, 'nope', NOW)).toBe(p)
  })
})

describe('editing helpers', () => {
  it('times are local and survive a round trip', () => {
    const { start, end } = workoutTimes('2026-10-05', '18:30', 45)
    expect(timeOf(start)).toBe('18:30')
    expect(new Date(start).getDate()).toBe(5)
    expect(end - start).toBe(45 * 60000)
    expect(workoutTimes('2026-10-05', '18:30', -5).end).toBe(start)
  })

  it('a paper workout starts empty on its date', () => {
    const w = blankWorkout('Paper', '2026-10-05', NOW, () => 'id1')
    expect(w).toMatchObject({ id: 'id1', date: '2026-10-05', entries: [], prs: [], vol: 0, routineIds: [] })
    expect(w.end - w.start).toBe(3_600_000)
  })

  it('a new set repeats the last work set and is done', () => {
    const e = { exId: 'bench', sets: [set(50, 10, { warmup: true }), set(100, 5, { rir: 1 })] }
    expect(addRow(e).sets[2]).toEqual({ w: 100, r: 5, done: true })
  })

  it('new entries follow the exercise kind', () => {
    expect(newEntry('nope').sets).toEqual([{ w: undefined, r: undefined, done: true }])
  })

  it('swapping keeps sets when the kind stays', () => {
    const e = { exId: 'a', sets: [set(100, 5)], rx: { sets: 3, reps: 5, weight: 100 } }
    const out = swapEntry(e, 'b')
    expect(out.exId).toBe('b')
    expect(out.sets).toEqual(e.sets)
    expect(out.rx).toBeUndefined()
  })

  it('patching a per-side set keeps its sides in step', () => {
    const row: SetRow = { w: 20, r: 20, done: true, sides: { L: { w: 20, r: 10, done: true }, R: { w: 20, r: 10, done: true } } }
    const out = patchRow(row, { r: 15 })
    expect(out.r).toBe(15)
    expect(out.sides?.L.r).toBe(8)
    expect(out.sides?.R.r).toBe(7)
    expect(patchRow(row, { w: 25 }).sides?.R.w).toBe(25)
    expect(patchRow(set(10, 5), { w: 12 })).toEqual(set(12, 5))
  })

  it('cleaning drops empty rows and empty exercises', () => {
    const out = cleanEntries([
      { exId: 'a', sets: [set(100, 0), set(100, 5, { done: false })] },
      { exId: 'b', sets: [{ w: 10, done: true }] },
      { exId: 'c', sets: [{ sec: 30, done: true }, { min: 10, done: true }] },
    ])
    expect(out.map(e => e.exId)).toEqual(['a', 'c'])
    expect(out[0].sets).toEqual([set(100, 5)])
  })
})

describe('repeat', () => {
  it('starts today with the same numbers, nothing ticked and no old ratings', () => {
    const old = workout('a', 10, [set(50, 10, { warmup: true }), set(100, 5, { rir: 1, failure: true })], 'bench', { routineIds: ['r1', 'gone'], name: 'Push', note: 'tired' })
    old.entries[0].sg = 'a'
    const p = { ...profile([old]), routines: [{ id: 'r1', name: 'Push', ex: [], updatedAt: 1 }] }
    const s = repeatSession(p, old, NOW, () => 'new')
    expect(s).toMatchObject({ id: 'new', name: 'Push', start: NOW, routineIds: ['r1'], cur: 0 })
    expect(s.date).toBe(new Date(NOW).toISOString().slice(0, 10))
    expect(s.note).toBeUndefined()
    expect(s.entries[0].sg).toBe('a')
    expect(s.entries[0].sets).toEqual([{ w: 50, r: 10, warmup: true, done: false }, { w: 100, r: 5, done: false }])
  })

  it('resets per-side ticks', () => {
    const row: SetRow = { w: 20, r: 20, done: true, sides: { L: { w: 20, r: 10, done: true }, R: { w: 20, r: 10, done: true } } }
    const s = repeatSession(profile([]), workout('a', 1, [row]), NOW, () => 'n')
    expect(s.entries[0].sets[0].sides).toEqual({ L: { w: 20, r: 10, done: false }, R: { w: 20, r: 10, done: false } })
    expect(s.entries[0].sets[0].done).toBe(false)
  })
})

describe('cleanEntries with distance', () => {
  it('keeps a set that only has a distance', () => {
    const out = cleanEntries([{ exId: 'Running_Treadmill', sets: [{ km: 5, min: 0, done: false }] }])
    expect(out[0].sets[0].km).toBe(5)
  })
})

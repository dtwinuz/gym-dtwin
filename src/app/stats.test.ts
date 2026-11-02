import { describe, expect, it } from 'vitest'
import type { ExerciseLookup } from '../core/muscles'
import type { SetRow, WeighIn, Workout } from '../core/types'
import { aggregate, bwPercent, delta, effortDist, heatmapWeeks, muscleStrength, nearestWeighIn, periodRange, recentExercises, strengthSeries, structuralBalance } from './stats'

const set = (w: number, r: number, extra: Partial<SetRow> = {}): SetRow => ({ w, r, done: true, ...extra })

function workout(id: string, date: string, exId: string, sets: SetRow[], extra: Partial<Workout> = {}): Workout {
  const start = new Date(`${date}T10:00:00`).getTime()
  return { id, date, start, end: start + 3_600_000, routineIds: [], name: id, entries: [{ exId, sets }], prs: [], vol: sets.reduce((v, s) => v + (s.w ?? 0) * (s.r ?? 0), 0), updatedAt: start, ...extra }
}

describe('periods', () => {
  it('ends today and has an equal one right before it', () => {
    expect(periodRange('1m', '2026-11-02')).toEqual({ from: '2026-10-03', to: '2026-11-02', prevFrom: '2026-09-03', prevTo: '2026-10-02' })
    expect(periodRange('all', '2026-11-02')).toEqual({ from: null, to: '2026-11-02', prevFrom: null, prevTo: null })
  })

  it('clamps at a shorter month', () => {
    expect(periodRange('1m', '2026-03-31').from).toBe('2026-03-01')
    expect(periodRange('1y', '2026-11-02').from).toBe('2025-11-03')
  })

  it('aggregates only inside the range, warm-ups not counted as sets', () => {
    const ws = [
      workout('a', '2026-10-10', 'x', [set(100, 5), set(100, 5), set(50, 5, { warmup: true })]),
      workout('b', '2026-11-01', 'x', [set(100, 5)]),
      workout('c', '2026-08-01', 'x', [set(100, 5)]),
    ]
    expect(aggregate(ws, '2026-10-01', '2026-11-02')).toEqual({ workouts: 2, volume: 1750, sets: 3, minutes: 120 })
    expect(aggregate(ws, null, null).workouts).toBe(3)
    expect(aggregate(ws, '2027-01-01', null).workouts).toBe(0)
  })

  it('delta has no percentage without a base', () => {
    expect(delta(15, 10)).toEqual({ diff: 5, pct: 50 })
    expect(delta(3, 0)).toEqual({ diff: 3, pct: null })
  })
})

describe('heatmap', () => {
  it('starts each column on the chosen weekday and marks the future', () => {
    const today = '2026-11-04' // a Wednesday
    const monday = heatmapWeeks([], 1, today)
    expect(monday).toHaveLength(53)
    expect(monday.every(col => new Date(`${col[0].date}T00:00:00`).getDay() === 1)).toBe(true)
    const sunday = heatmapWeeks([], 0, today)
    expect(sunday.every(col => new Date(`${col[0].date}T00:00:00`).getDay() === 0)).toBe(true)
    const last = monday[52]
    expect(last[0].date).toBe('2026-11-02')
    expect(last[2]).toMatchObject({ date: today, future: false })
    expect(last[3].future).toBe(true)
  })

  it('shades days relative to the busiest one', () => {
    const ws = [
      workout('a', '2026-11-02', 'x', Array.from({ length: 8 }, () => set(50, 5))),
      workout('b', '2026-11-03', 'x', [set(50, 5)]),
    ]
    const days = heatmapWeeks(ws, 1, '2026-11-04').flat()
    expect(days.find(d => d.date === '2026-11-02')).toMatchObject({ sets: 8, level: 4 })
    expect(days.find(d => d.date === '2026-11-03')).toMatchObject({ sets: 1, level: 1 })
    expect(days.find(d => d.date === '2026-11-04')).toMatchObject({ sets: 0, level: 0 })
  })
})

describe('effort', () => {
  it('reads RIR, RPE and failure on one scale and skips warm-ups', () => {
    const ws = [workout('a', '2026-11-01', 'x', [
      set(100, 5, { rir: 2 }),
      set(100, 5, { rpe: 8 }),
      set(100, 5, { failure: true, rir: 3 }),
      set(100, 5, { rir: 7 }),
      set(50, 5, { rir: 1, warmup: true }),
      set(100, 5),
    ])]
    expect(effortDist(ws, null, null)).toEqual([1, 0, 2, 0, 0, 1])
  })

  it('is null without any rating', () => {
    expect(effortDist([workout('a', '2026-11-01', 'x', [set(100, 5)])], null, null)).toBeNull()
    expect(effortDist([], null, null)).toBeNull()
  })
})

describe('strength', () => {
  const ws = [
    workout('b', '2026-10-08', 'bench', [set(100, 5)], { prs: ['bench'] }),
    workout('a', '2026-10-01', 'bench', [set(90, 5), set(80, 12)]),
    workout('c', '2026-10-09', 'curl', [set(0, 10)]),
  ]

  it('gives one point per session, oldest first, with PR flags', () => {
    const s = strengthSeries(ws, 'bench', 'epley')
    expect(s.map(p => p.id)).toEqual(['a', 'b'])
    expect(s[0]).toMatchObject({ best: 90, e1rm: 112 })
    expect(s[1].pr).toBe(true)
    expect(s[0].pr).toBe(false)
  })

  it('honours the period, the formula and leaves out assisted or unloaded sets', () => {
    expect(strengthSeries(ws, 'bench', 'epley', '2026-10-05').map(p => p.id)).toEqual(['b'])
    expect(strengthSeries(ws, 'bench', 'brzycki')[1].e1rm).toBeCloseTo(112.5, 1)
    expect(strengthSeries(ws, 'curl', 'epley')).toEqual([])
    const assisted = workout('d', '2026-10-10', 'dip', [set(20, 10)])
    assisted.entries[0].target = { exId: 'dip', sets: 3, reps: 10, weight: 20, assisted: true }
    expect(strengthSeries([assisted], 'dip', 'epley')).toEqual([])
  })

  it('lists exercises latest first', () => {
    expect(recentExercises(ws)).toEqual(['curl', 'bench'])
  })

  it('finds the nearest weigh-in for the body-weight share', () => {
    const list: WeighIn[] = [{ date: '2026-01-01', w: 90, t: 0 }, { date: '2026-10-01', w: 80, t: 1 }, { date: '2026-10-20', w: 79, t: 2 }]
    expect(nearestWeighIn(list, '2026-10-05')?.w).toBe(80)
    expect(nearestWeighIn(list, '2026-10-15')?.w).toBe(79)
    expect(nearestWeighIn([], '2026-10-15')).toBeNull()
    expect(bwPercent(120, 80)).toBe(150)
    expect(bwPercent(120, 0)).toBeNull()
  })

  it('structural balance needs all four lifts', () => {
    const three = [
      workout('s', '2026-10-01', 'Barbell_Squat', [set(100, 1)]),
      workout('d', '2026-10-01', 'Barbell_Deadlift', [set(125, 1)]),
      workout('b', '2026-10-01', 'Barbell_Bench_Press_-_Medium_Grip', [set(75, 1)]),
    ]
    expect(structuralBalance(three, 'epley')).toBeNull()
    const four = [...three, workout('o', '2026-10-01', 'Standing_Military_Press', [set(50, 1)])]
    const out = structuralBalance(four, 'epley')
    expect(out?.lifts).toEqual({ squat: 100, deadlift: 125, bench: 75, ohp: 50 })
    expect(out?.rows.map(r => r.ratio)).toEqual([0.8, 0.75, 0.67])
    expect(out?.rows.map(r => r.rule)).toEqual([0.85, 0.75, 0.65])
  })

  it('compares a muscle only with the lifter\'s own peak', () => {
    const lookup: ExerciseLookup = id => (id === 'bench' ? { primary: ['chest'], secondary: ['triceps'] } : undefined)
    const log = [
      workout('old', '2026-01-01', 'bench', [set(100, 1)]),
      workout('new', '2026-10-20', 'bench', [set(80, 1)]),
    ]
    const out = muscleStrength(log, lookup, 'epley', '2026-10-01')
    expect(out.chest).toEqual({ now: 80, peak: 100, ratio: 0.8 })
    expect(out.triceps).toBeUndefined()
    expect(muscleStrength(log, lookup, 'epley', '2026-11-01').chest).toBeUndefined()
  })
})

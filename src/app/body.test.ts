import { describe, expect, it } from 'vitest'
import { fromDisplayLength, goalFit, lengthUnit, measureKeys, measureSeries, removeMeasurement, removeWeighIn, saveMeasurement, saveWeighIn, toDisplayLength, weeklyRate } from './body'
import { fitSize } from './photos'
import { convertProfileUnits } from './convert'
import { addWeighIn } from './plan'
import { emptyProfile } from './profile'

const NOW = 1_800_000_000_000
const blank = () => emptyProfile(NOW, 'en')

describe('weekly rate', () => {
  it('is the slope per week over the last four weeks', () => {
    const pts = [{ date: '2026-10-01', w: 80 }, { date: '2026-10-08', w: 79.5 }, { date: '2026-10-15', w: 79 }]
    expect(weeklyRate(pts)).toBe(-0.5)
    expect(weeklyRate([...pts].reverse())).toBe(-0.5)
  })

  it('ignores what is older than the window', () => {
    const pts = [{ date: '2026-01-01', w: 120 }, { date: '2026-10-01', w: 80 }, { date: '2026-10-15', w: 81 }]
    expect(weeklyRate(pts)).toBe(0.5)
  })

  it('needs two weigh-ins some days apart', () => {
    expect(weeklyRate([])).toBeNull()
    expect(weeklyRate([{ date: '2026-10-01', w: 80 }])).toBeNull()
    expect(weeklyRate([{ date: '2026-10-01', w: 80 }, { date: '2026-10-02', w: 81 }])).toBeNull()
  })

  it('tells whether it points at the goal', () => {
    expect(goalFit(-0.5, 'lose', 'kg')).toBe('match')
    expect(goalFit(0.5, 'lose', 'kg')).toBe('opposite')
    expect(goalFit(0.5, 'gain', 'kg')).toBe('match')
    expect(goalFit(0.05, 'gain', 'kg')).toBe('steady')
    expect(goalFit(0.05, 'hold', 'kg')).toBe('match')
    expect(goalFit(-0.5, 'hold', 'kg')).toBe('opposite')
    expect(goalFit(0.3, 'hold', 'lb')).toBe('match')
    expect(goalFit(0.3, 'hold', 'kg')).toBe('opposite')
  })
})

describe('measurement conversion', () => {
  it('stores cm and shows the unit setting', () => {
    expect(lengthUnit('kg')).toBe('cm')
    expect(lengthUnit('lb')).toBe('in')
    expect(toDisplayLength(80, 'kg')).toBe(80)
    expect(toDisplayLength(80, 'lb')).toBe(31.5)
    expect(fromDisplayLength(31.5, 'lb')).toBe(80.01)
    expect(fromDisplayLength(80, 'kg')).toBe(80)
  })

  it('a change of unit setting leaves stored measurements alone', () => {
    const p = saveMeasurement(blank(), '2026-10-01', { waist: 80 }, undefined, NOW)
    expect(convertProfileUnits(p, 'lb').measurements[0].values.waist).toBe(80)
  })
})

describe('body records', () => {
  it('a date holds one weigh-in; moving it leaves a tombstone on the old date', () => {
    let p = saveWeighIn(blank(), 80, '2026-10-01', undefined, NOW)
    p = saveWeighIn(p, 81, '2026-10-01', undefined, NOW)
    expect(p.bodyweight).toEqual([{ date: '2026-10-01', w: 81, t: NOW }])
    p = saveWeighIn(p, 82, '2026-10-02', '2026-10-01', NOW)
    expect(p.bodyweight.map(b => b.date)).toEqual(['2026-10-02'])
    expect(p.deleted.bodyweight['2026-10-01']).toBe(NOW)
  })

  it('delete then undo lifts the tombstone, also via the Home shortcut', () => {
    let p = saveWeighIn(blank(), 80, '2026-10-01', undefined, NOW)
    p = removeWeighIn(p, '2026-10-01', NOW)
    expect(p.bodyweight).toEqual([])
    expect(p.deleted.bodyweight['2026-10-01']).toBe(NOW)
    const back = saveWeighIn(p, 80, '2026-10-01', undefined, NOW)
    expect(back.deleted.bodyweight['2026-10-01']).toBeUndefined()
    expect(addWeighIn(p, 80, '2026-10-01', NOW).deleted.bodyweight['2026-10-01']).toBeUndefined()
  })

  it('measurements replace by date, can be deleted and restored', () => {
    let p = saveMeasurement(blank(), '2026-10-01', { waist: 80 }, undefined, NOW)
    p = saveMeasurement(p, '2026-10-01', { waist: 79, Forearm: 30 }, undefined, NOW)
    expect(p.measurements).toHaveLength(1)
    expect(p.measurements[0].values).toEqual({ waist: 79, Forearm: 30 })
    const gone = removeMeasurement(p, '2026-10-01', NOW)
    expect(gone.measurements).toEqual([])
    expect(gone.deleted.measurements['2026-10-01']).toBe(NOW)
    expect(saveMeasurement(gone, '2026-10-01', { waist: 79 }, undefined, NOW).deleted.measurements['2026-10-01']).toBeUndefined()
  })

  it('lists built-in measures, then custom names, and gives a dated series', () => {
    let p = saveMeasurement(blank(), '2026-10-05', { waist: 80, Forearm: 30 }, undefined, NOW)
    p = saveMeasurement(p, '2026-10-01', { waist: 81 }, undefined, NOW)
    expect(measureKeys(p.measurements)).toEqual(['waist', 'chest', 'hip', 'thigh', 'arm', 'calf', 'neck', 'Forearm'])
    expect(measureSeries(p.measurements, 'waist')).toEqual([{ date: '2026-10-01', v: 81 }, { date: '2026-10-05', v: 80 }])
    expect(measureSeries(p.measurements, 'chest')).toEqual([])
  })
})

describe('photo sizing', () => {
  it('fits the long side and never scales up', () => {
    expect(fitSize(4000, 3000)).toEqual({ w: 1280, h: 960 })
    expect(fitSize(3000, 4000)).toEqual({ w: 960, h: 1280 })
    expect(fitSize(800, 600)).toEqual({ w: 800, h: 600 })
  })
})

import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../catalogue'
import { LEGACY_EX, migrateLegacy, type LegacyState } from './legacy'
import { deleteItem, detectLang, emptyProfile, normalizeProfile, upsertItem } from './profile'
import { KEY, LEGACY_KEY, loadProfile } from './store'
import { ACCENTS, THEME_BG, accentInk, accentTokens, contrast, parseHex, readableAccent } from './color'
import { convertProfileUnits } from './convert'
import { matchesLabels } from './match'
import type { CustomExercise } from '../core/types'

const memory = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init))
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
}

const v1: LegacyState = {
  lang: 'ru',
  planId: 'ppl',
  workouts: [
    { id: 'w1', date: '2026-10-01', planId: 'ppl', dayName: 'Push', sets: [
      { exId: 'bench', kg: 60, reps: 8 }, { exId: 'bench', kg: 62.5, reps: 6 }, { exId: 'ohp', kg: 40, reps: 8 },
    ] },
    { id: 'w2', date: '2026-10-03', planId: 'ppl', dayName: 'Pull', sets: [{ exId: 'Barbell_Deadlift', kg: 100, reps: 5 }] },
  ],
  bodyWeight: [{ date: '2026-10-01', kg: 80 }, { date: '2026-10-05', kg: 79.4 }],
  goalKg: 75,
  favEx: ['squat', 'Plank'],
  customEx: [{ id: 'custom-a', n: 'Band pull', g: 'back', eq: 'bands', p: ['lats'], s: [], c: 'strength' }],
  gear: ['dumbbell'],
  figure: 'female',
}

describe('legacy migration', () => {
  const ids = new Set(CATALOGUE.map(e => e.id))

  it('maps every old exercise id to a catalogue id', () => {
    for (const [old, id] of Object.entries(LEGACY_EX)) expect(ids.has(id), `${old} -> ${id}`).toBe(true)
  })

  it('turns v1 workouts into grouped core entries', () => {
    const p = migrateLegacy(v1, 1000)
    expect(p.workouts).toHaveLength(2)
    const w = p.workouts[0]
    expect(w.name).toBe('Push')
    expect(w.routineIds).toEqual(['ppl'])
    expect(w.entries.map(e => e.exId)).toEqual(['Barbell_Bench_Press_-_Medium_Grip', 'Standing_Military_Press'])
    expect(w.entries[0].sets).toEqual([{ w: 60, r: 8, done: true }, { w: 62.5, r: 6, done: true }])
    expect(w.vol).toBe(60 * 8 + 62.5 * 6 + 40 * 8)
    expect(new Date(w.start).getHours()).toBe(12)
    expect(w.start).toBe(w.end)
    expect(w.prs).toEqual([])
    expect(p.workouts[1].entries[0].exId).toBe('Barbell_Deadlift')
  })

  it('carries body weight, goal, favourites, custom exercises and settings', () => {
    const p = migrateLegacy(v1, 1000)
    expect(p.bodyweight.map(b => [b.date, b.w])).toEqual([['2026-10-01', 80], ['2026-10-05', 79.4]])
    expect(p.targetW).toBe(75)
    expect(p.favEx).toEqual(['Barbell_Squat', 'Plank'])
    expect(p.customEx[0]).toMatchObject({ id: 'custom-a', name: 'Band pull', bodyPart: 'back', primary: ['lats'] })
    expect(p.gear).toEqual(['dumbbell'])
    expect(p.settings.lang).toBe('ru')
    expect(p.settings.body).toBe('female')
    expect(p.planId).toBe('ppl')
  })

  it('migrates once: v1 is read only when v2 is absent, and v2 is written', () => {
    const kv = memory({ [LEGACY_KEY]: JSON.stringify(v1) })
    const p = loadProfile(kv, 5)
    expect(p.workouts).toHaveLength(2)
    expect(kv.m.has(KEY)).toBe(true)
    const again = loadProfile(memory({ [LEGACY_KEY]: JSON.stringify({ ...v1, workouts: [] }), [KEY]: kv.m.get(KEY)! }))
    expect(again.workouts).toHaveLength(2)
  })

  it('survives missing, corrupt or throwing storage', () => {
    expect(loadProfile(null).workouts).toEqual([])
    expect(loadProfile(memory({ [KEY]: '{oops' })).workouts).toEqual([])
    const throwing = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
    expect(loadProfile(throwing).settings.unit).toBe('kg')
  })

  it('fills settings added after a profile was saved', () => {
    const p = normalizeProfile({ settings: { lang: 'en' } as never, workouts: [] })
    expect(p.settings.lang).toBe('en')
    expect(p.settings.restSec).toBe(90)
    expect(p.settings.safetyAck).toBeNull()
    expect(p.deleted).toEqual({})
  })
})

describe('list items and tombstones', () => {
  const ex: CustomExercise = { id: 'c1', name: 'X', bodyPart: 'arms', equipment: 'cable', primary: ['biceps'], secondary: [], category: 'strength' }

  it('stamps updatedAt on insert and replace', () => {
    let p = upsertItem(emptyProfile(0), 'customEx', ex, 10)
    expect(p.customEx).toEqual([{ ...ex, updatedAt: 10 }])
    p = upsertItem(p, 'customEx', { ...ex, name: 'Y' }, 20)
    expect(p.customEx).toHaveLength(1)
    expect(p.customEx[0]).toMatchObject({ name: 'Y', updatedAt: 20 })
  })

  it('deleting leaves a tombstone; restoring lifts it', () => {
    let p = upsertItem(emptyProfile(0), 'customEx', ex, 10)
    p = deleteItem(p, 'customEx', 'c1', 30)
    expect(p.customEx).toEqual([])
    expect(p.deleted.customEx).toEqual({ c1: 30 })
    p = upsertItem(p, 'customEx', ex, 40)
    expect(p.customEx).toHaveLength(1)
    expect(p.deleted.customEx).toEqual({})
  })

  it('keeps tombstones of other lists apart', () => {
    let p = deleteItem(emptyProfile(0), 'workouts', 'w1', 5)
    p = deleteItem(p, 'customEx', 'c9', 6)
    expect(p.deleted).toEqual({ workouts: { w1: 5 }, customEx: { c9: 6 } })
  })
})

describe('language detection', () => {
  it('picks the first supported browser language, uz otherwise', () => {
    expect(detectLang(['ru-RU', 'en'])).toBe('ru')
    expect(detectLang(['de-DE', 'en-US'])).toBe('en')
    expect(detectLang(['uz-Latn-UZ'])).toBe('uz')
    expect(detectLang(['fr'])).toBe('uz')
    expect(detectLang([])).toBe('uz')
  })
})

describe('accent colour', () => {
  it('parses hex', () => {
    expect(parseHex('#c6f432')).toEqual([198, 244, 50])
    expect(parseHex('fff')).toEqual([255, 255, 255])
    expect(parseHex('nope')).toBeNull()
  })

  it('computes WCAG contrast', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5)
  })

  it('every preset reaches AA against both backgrounds after adjustment', () => {
    for (const c of ACCENTS) {
      for (const mode of ['dark', 'light'] as const) {
        const { accent, ink } = accentTokens(c, mode)
        expect(contrast(accent, THEME_BG[mode]), `${c} ${mode}`).toBeGreaterThanOrEqual(4.5)
        expect(contrast(accent, ink), `${c} ink`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('leaves readable colours alone and keeps the hue when adjusting', () => {
    expect(readableAccent('#c6f432', THEME_BG.dark)).toBe('#c6f432')
    const fixed = readableAccent('#c6f432', THEME_BG.light)
    expect(fixed).not.toBe('#c6f432')
    const [r, g, b] = parseHex(fixed)!
    expect(g).toBeGreaterThan(r)
    expect(g).toBeGreaterThan(b)
    expect(readableAccent('#101010', THEME_BG.dark)).not.toBe('#101010')
  })

  it('picks dark ink on light accents and white on dark ones', () => {
    expect(accentInk('#c6f432')).toBe('#111111')
    expect(accentInk('#1a237e')).toBe('#ffffff')
  })
})

describe('unit conversion of the profile', () => {
  it('converts every stored weight and back without drift', () => {
    let p = migrateLegacy(v1, 0)
    p = { ...p, exWeights: { Barbell_Squat: { w: 100, date: '2026-10-01' } }, barWeights: { Barbell_Squat: 20 } }
    const lb = convertProfileUnits(p, 'lb')
    expect(lb.settings.unit).toBe('lb')
    expect(lb.workouts[0].entries[0].sets[0].w).toBeCloseTo(132.28, 2)
    expect(lb.bodyweight[0].w).toBeCloseTo(176.37, 2)
    expect(lb.targetW).toBeCloseTo(165.35, 2)
    expect(lb.exWeights.Barbell_Squat.w).toBeCloseTo(220.46, 2)
    expect(lb.barWeights.Barbell_Squat).toBeCloseTo(44.09, 2)
    const kg = convertProfileUnits(lb, 'kg')
    expect(kg.workouts[0].entries[0].sets[1].w).toBe(62.5)
    expect(kg.bodyweight[1].w).toBe(79.4)
    expect(kg.targetW).toBe(75)
    expect(convertProfileUnits(kg, 'kg')).toBe(kg)
  })
})

describe('settings search', () => {
  const labels = ['Vazn birligi', 'Единица веса', 'Weight unit']
  it('matches in any language, case and apostrophe insensitive', () => {
    expect(matchesLabels(labels, 'vazn')).toBe(true)
    expect(matchesLabels(labels, 'ВЕС')).toBe(true)
    expect(matchesLabels(labels, 'weight unit')).toBe(true)
    expect(matchesLabels(labels, 'theme')).toBe(false)
    expect(matchesLabels(['Ko\'rinish'], 'ko’rinish')).toBe(true)
    expect(matchesLabels(labels, '  ')).toBe(true)
  })
})

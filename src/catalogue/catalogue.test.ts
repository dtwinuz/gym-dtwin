/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { CATALOGUE, exerciseById, exerciseName, exerciseSteps, isExdb, similarExercises, type CatalogueExercise } from './index'
import { buildIndex, distance, normalize, search } from './search'
import { MUSCLE_REGIONS, exerciseLevels } from './BodyMap'
import { MUSCLE_NAME, EQUIPMENT_NAME, GROUP_NAME, CATEGORY_NAME } from './labels'
import body from './data/body.json'
import base from './data/exercises.json'

const docs = buildIndex(CATALOGUE)
const top = (q: string, n = 5) => search(docs, q).slice(0, n).map(e => e.id)

describe('catalogue data', () => {
  it('has the whole free-exercise-db set with unique ids', () => {
    expect(CATALOGUE.length).toBeGreaterThanOrEqual(870)
    expect(new Set(CATALOGUE.map(e => e.id)).size).toBe(CATALOGUE.length)
  })

  it('has uz and ru names for the most used exercises', () => {
    const translated = CATALOGUE.filter(e => e.uz && e.ru)
    expect(translated.length).toBeGreaterThanOrEqual(150)
    expect(exerciseName(CATALOGUE.find(e => e.id === 'Barbell_Deadlift'), 'ru')).toMatch(/Становая/)
  })

  it('uz names use Latin script only', () => {
    for (const e of CATALOGUE) if (e.uz) expect(e.uz, e.id).not.toMatch(/[Ѐ-ӿ]/)
  })

  it('every muscle, equipment, group and category has a label in all languages', () => {
    for (const e of CATALOGUE) {
      for (const m of [...e.p, ...e.s]) expect(MUSCLE_NAME[m], m).toBeDefined()
      expect(EQUIPMENT_NAME[e.eq], e.eq).toBeDefined()
      expect(GROUP_NAME[e.g], e.g).toBeDefined()
      expect(CATEGORY_NAME[e.c], e.c).toBeDefined()
    }
  })

  it('every catalogue muscle maps to a drawn body region', () => {
    const drawn = new Set(Object.values(body).flatMap(f => Object.values(f).flatMap(v => Object.keys(v.parts))))
    for (const m of Object.keys(MUSCLE_NAME)) {
      expect(MUSCLE_REGIONS[m], m).toBeDefined()
      for (const r of MUSCLE_REGIONS[m]) expect(drawn.has(r), r).toBe(true)
    }
  })

  it('ships an image file for every image the catalogue declares', () => {
    for (const e of CATALOGUE) for (let n = 0; n < e.i; n++) expect(existsSync(`public/ex/${e.id}/${n}.webp`), e.id).toBe(true)
  })

  it('loads localized steps and falls back to English', async () => {
    const uz = await exerciseSteps('Barbell_Squat', 'uz')
    expect(uz.lang).toBe('uz')
    expect(uz.steps.length).toBeGreaterThanOrEqual(3)
    const rare = CATALOGUE.find(e => !e.uz && e.id !== 'Barbell_Squat')!
    expect((await exerciseSteps(rare.id, 'ru')).lang).toBe('en')
  })

  it('suggests similar exercises on the same primary muscle', () => {
    const sim = similarExercises('Barbell_Bench_Press_-_Medium_Grip')
    expect(sim.length).toBeGreaterThan(0)
    for (const x of sim) expect(x.p[0]).toBe('chest')
  })
})

describe('search', () => {
  it('normalizes Cyrillic, Uzbek apostrophes and case', () => {
    expect(normalize('Жим лёжа')).toBe('zhim lezha')
    expect(normalize("Ko'krak O‘RTA")).toBe('kokrak orta')
  })

  it('distance handles typos and transpositions', () => {
    expect(distance('sqaut', 'squat', 1)).toBe(1)
    expect(distance('deadlfit', 'deadlift', 2)).toBe(1)
    expect(distance('bench', 'curl', 1)).toBeGreaterThan(1)
  })

  it('finds by English name', () => {
    expect(top('barbell squat')).toContain('Barbell_Squat')
  })

  it('finds by Russian name in Cyrillic and in Latin transliteration', () => {
    expect(top('становая')).toContain('Barbell_Deadlift')
    expect(top('stanovaya')).toContain('Barbell_Deadlift')
    expect(top('жим лёжа')).toContain('Barbell_Bench_Press_-_Medium_Grip')
  })

  it('finds by Uzbek words and gym slang', () => {
    expect(top('turnik')).toContain('Pullups')
    expect(top('prised')).toContain('Barbell_Squat')
    expect(top('gantel jim', 10).some(id => /Dumbbell.*Press/.test(id))).toBe(true)
  })

  it('puts the canonical lift first', () => {
    expect(top('stanovaya')[0]).toBe('Barbell_Deadlift')
    expect(top('жим лёжа')[0]).toBe('Barbell_Bench_Press_-_Medium_Grip')
    expect(top('turnik')[0]).toBe('Pullups')
  })

  it('tolerates typos', () => {
    expect(top('sqaut')).toContain('Barbell_Squat')
    expect(top('deadlfit')).toContain('Barbell_Deadlift')
  })

  it('ranks favourites higher', () => {
    const plain = search(docs, 'curl').map(e => e.id)
    const pick = plain[20]
    const boosted = search(docs, 'curl', { fav: new Set([pick]) }).map(e => e.id)
    expect(boosted.indexOf(pick)).toBeLessThan(20)
  })

  it('is fast enough for typing', () => {
    const t0 = performance.now()
    for (const q of ['bench', 'stanovaya', 'gantel', 'sqaut', 'жим']) search(docs, q)
    expect((performance.now() - t0) / 5).toBeLessThan(30)
  })
})

describe('exercises-dataset text', () => {
  const added = CATALOGUE.filter(e => isExdb(e.id))
  const baseDocs = buildIndex(base as CatalogueExercise[])

  it('adds the deduplicated text-only entries', () => {
    expect(added.length).toBeGreaterThanOrEqual(900)
    expect(CATALOGUE.length).toBeGreaterThanOrEqual(1800)
    expect(added.filter(e => e.uz && e.ru).length).toBeGreaterThanOrEqual(150)
    for (const e of added) {
      expect(e.i, e.id).toBe(0)
      expect(e.uz ?? '', e.id).not.toMatch(/[Ѐ-ӿ]/)
    }
  })

  it('carries no media, media ids or links', () => {
    for (const f of ['exdb.json', 'exdb.steps.en.json', 'exdb.steps.ru.json']) {
      const text = readFileSync(`src/catalogue/data/${f}`, 'utf8').toLowerCase()
      for (const bad of ['gymvisual', 'gym visual', '.gif', 'videos/', 'images/', 'media_id', 'gif_url', 'attribution', 'http']) {
        expect(text.includes(bad), `${f}: ${bad}`).toBe(false)
      }
    }
  })

  it('does not repeat a free-exercise-db name', () => {
    const names = new Set(base.map(e => normalize(e.n)))
    for (const e of added) expect(names.has(normalize(e.n)), e.n).toBe(false)
  })

  it('handles entries without muscles', () => {
    const bare = added.find(e => e.p.length === 0)!
    expect(bare).toBeDefined()
    expect(bare.g).toBe('other')
    expect(exerciseLevels([], [])).toEqual({})
    expect(() => exerciseLevels(bare.p, bare.s)).not.toThrow()
    expect(similarExercises(bare.id)).toEqual([])
    expect(exerciseById(bare.id)).toBe(bare)
  })

  it('uses Russian steps where present and English for Uzbek', async () => {
    const id = added.find(e => e.uz)!.id
    expect((await exerciseSteps(id, 'ru')).lang).toBe('ru')
    const uz = await exerciseSteps(id, 'uz')
    expect(uz.lang).toBe('en')
    expect(uz.steps.length).toBeGreaterThan(0)
  })

  it('keeps the top results of common queries', () => {
    for (const q of ['bench', 'squat', 'jim', 'присед', 'tortish', 'stanovaya', 'turnik', 'deadlift', 'gantel']) {
      const after = top(q, 5)
      for (const id of search(baseDocs, q).slice(0, 3).map(e => e.id)) expect(after, q).toContain(id)
    }
    for (const q of ['bench', 'squat', 'jim', 'присед', 'tortish']) {
      const before = search(baseDocs, q).slice(0, 5).map(e => e.id)
      expect(top(q, 5), q).toEqual(before)
    }
  })

  it('keeps the canonical bench press first for the Russian query', () => {
    expect(top('жим лёжа')[0]).toBe('Barbell_Bench_Press_-_Medium_Grip')
  })

  it('finds the new entries by their uz and ru names', () => {
    expect(search(docs, 'Pendlay').some(e => e.id === 'exdb_3017')).toBe(true)
    expect(search(docs, 'тяга пендлея')[0]?.id).toBe('exdb_3017')
    expect(search(docs, 'girya siltash')[0]?.id).toBe('exdb_0549')
    expect(search(docs, 'cardio').some(e => isExdb(e.id) && e.g === 'other')).toBe(true)
  })
})

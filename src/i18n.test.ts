import { describe, expect, it } from 'vitest'
import { HINT_ONLY, LANGS, dict, type Key } from './i18n'
import { CATEGORY_NAME, EQUIPMENT_NAME, GROUP_NAME, LEVEL_NAME, MUSCLE_NAME } from './catalogue/labels'

const CYRILLIC = /[Ѐ-ӿ]/

const tables: [string, Record<string, Record<string, string>>][] = [
  ['dict', dict],
  ['GROUP_NAME', GROUP_NAME],
  ['MUSCLE_NAME', MUSCLE_NAME],
  ['EQUIPMENT_NAME', EQUIPMENT_NAME],
  ['CATEGORY_NAME', CATEGORY_NAME],
  ['LEVEL_NAME', LEVEL_NAME],
]

describe('ui strings', () => {
  for (const [name, table] of tables) {
    it(`${name}: every key has uz, ru and en`, () => {
      const missing: string[] = []
      for (const [key, row] of Object.entries(table)) {
        for (const l of LANGS) {
          if ((row[l] ?? '').trim()) continue
          if (name === 'dict' && l === 'en' && HINT_ONLY.includes(key as Key)) continue
          missing.push(`${key}.${l}`)
        }
      }
      expect(missing).toEqual([])
    })

    it(`${name}: uz is Latin only`, () => {
      const bad = Object.entries(table).filter(([, row]) => CYRILLIC.test(row.uz ?? '')).map(([k]) => k)
      expect(bad).toEqual([])
    })
  }

  it('ru strings are actually Russian where they differ from en', () => {
    const lazy = Object.entries(dict).filter(([, r]) => r.ru === r.en && /[a-z]{4,}/i.test(r.en) && !/^[A-Z0-9 ()×.,·-]+$/.test(r.en))
    expect(lazy.map(([k]) => k)).toEqual([])
  })
})

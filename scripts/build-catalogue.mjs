#!/usr/bin/env node
// Builds src/catalogue/data/*.json from a checkout of yuhonas/free-exercise-db (Unlicense)
// plus our own uz/ru texts in content/exercises-i18n.json.
//   node scripts/build-catalogue.mjs <path-to-free-exercise-db>
// Images are a separate step: python -I scripts/build-images.py <path> public/ex
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const src = process.argv[2]
if (!src) {
  console.error('usage: node scripts/build-catalogue.mjs <free-exercise-db dir>')
  process.exit(1)
}

const EQUIPMENT = {
  'body only': 'bodyweight',
  barbell: 'barbell',
  dumbbell: 'dumbbell',
  cable: 'cable',
  machine: 'machine',
  kettlebells: 'kettlebell',
  bands: 'band',
  'medicine ball': 'medicine ball',
  'exercise ball': 'exercise ball',
  'foam roll': 'foam roll',
  'e-z curl bar': 'ez bar',
  other: 'other',
}

const GROUP = {
  chest: 'chest',
  lats: 'back', 'middle back': 'back', 'lower back': 'back', traps: 'back',
  shoulders: 'shoulders',
  biceps: 'arms', triceps: 'arms', forearms: 'arms',
  quadriceps: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs', adductors: 'legs', abductors: 'legs',
  abdominals: 'core',
  neck: 'neck',
}

const CATEGORY = {
  strength: 'strength',
  powerlifting: 'strength',
  'olympic weightlifting': 'olympic',
  strongman: 'strongman',
  plyometrics: 'plyometrics',
  stretching: 'stretching',
  cardio: 'cardio',
}

const i18n = JSON.parse(readFileSync('content/exercises-i18n.json', 'utf8'))
const dir = join(src, 'exercises')
const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort()
const meta = []
const steps = { en: {}, uz: {}, ru: {} }

for (const f of files) {
  const x = JSON.parse(readFileSync(join(dir, f), 'utf8'))
  const primary = x.primaryMuscles ?? []
  const tr = i18n[x.id]
  const row = {
    id: x.id,
    n: x.name.trim(),
    g: GROUP[primary[0]] ?? 'other',
    eq: EQUIPMENT[x.equipment ?? 'other'] ?? 'other',
    p: primary,
    s: (x.secondaryMuscles ?? []).filter(m => !primary.includes(m)),
    c: CATEGORY[x.category] ?? 'strength',
    l: x.level,
  }
  if (x.mechanic) row.m = x.mechanic === 'compound' ? 'c' : 'i'
  if (x.force) row.f = x.force
  row.i = (x.images ?? []).length
  if (tr) {
    row.uz = tr.uz.n
    row.ru = tr.ru.n
    if (tr.a?.length) row.a = tr.a
    steps.uz[x.id] = tr.uz.s
    steps.ru[x.id] = tr.ru.s
  }
  meta.push(row)
  const en = (x.instructions ?? []).map(s => s.trim()).filter(Boolean)
  if (en.length) steps.en[x.id] = en
}

const missing = Object.keys(i18n).filter(id => !meta.some(m => m.id === id))
if (missing.length) {
  console.error('content/exercises-i18n.json has unknown ids:', missing.join(', '))
  process.exit(1)
}

const out = 'src/catalogue/data'
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'exercises.json'), JSON.stringify(meta))
for (const [lang, s] of Object.entries(steps)) writeFileSync(join(out, `steps.${lang}.json`), JSON.stringify(s))
console.log(`${meta.length} exercises, ${Object.keys(i18n).length} with uz/ru, steps en ${Object.keys(steps.en).length}`)

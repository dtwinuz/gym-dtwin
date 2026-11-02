#!/usr/bin/env node
// Builds src/catalogue/data/exdb*.json from hasaneyldrm/exercises-dataset (MIT, text only) at a pinned commit,
// plus our own uz/ru names in content/exdb-i18n.json. Media (images, GIFs, videos, media ids) is never read or kept.
//   node scripts/build-exdb.mjs [path-to-local-exercises.json]
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const SHA = '7455efae41b330c265e7cd4b78dfa848e7ce5ebd'
const URL_JSON = `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/${SHA}/data/exercises.json`

const EQUIPMENT = {
  'body weight': 'bodyweight', weighted: 'other', assisted: 'machine',
  dumbbell: 'dumbbell', barbell: 'barbell', 'olympic barbell': 'barbell', 'ez barbell': 'ez bar', 'trap bar': 'other',
  cable: 'cable', rope: 'other',
  'leverage machine': 'machine', 'smith machine': 'machine', 'sled machine': 'machine', 'skierg machine': 'machine',
  'upper body ergometer': 'machine', 'stationary bike': 'machine', 'elliptical machine': 'machine', 'stepmill machine': 'machine',
  band: 'band', 'resistance band': 'band', kettlebell: 'kettlebell', 'medicine ball': 'medicine ball',
  'stability ball': 'exercise ball', 'bosu ball': 'exercise ball', roller: 'foam roll',
}

const MUSCLE = {
  abs: 'abdominals', abdominals: 'abdominals', core: 'abdominals', obliques: 'abdominals', 'lower abs': 'abdominals',
  pectorals: 'chest', chest: 'chest', 'upper chest': 'chest', 'serratus anterior': 'chest',
  biceps: 'biceps', brachialis: 'biceps', triceps: 'triceps',
  forearms: 'forearms', 'wrist flexors': 'forearms', 'wrist extensors': 'forearms', wrists: 'forearms', 'grip muscles': 'forearms', hands: 'forearms',
  delts: 'shoulders', deltoids: 'shoulders', shoulders: 'shoulders', 'rear deltoids': 'shoulders', 'rotator cuff': 'shoulders',
  lats: 'lats', 'latissimus dorsi': 'lats',
  'upper back': 'middle back', rhomboids: 'middle back', back: 'middle back',
  spine: 'lower back', 'lower back': 'lower back',
  traps: 'traps', trapezius: 'traps',
  'levator scapulae': 'neck', sternocleidomastoid: 'neck',
  glutes: 'glutes', quads: 'quadriceps', quadriceps: 'quadriceps', hamstrings: 'hamstrings',
  calves: 'calves', soleus: 'calves', adductors: 'adductors', groin: 'adductors', 'inner thighs': 'adductors', abductors: 'abductors',
}

const GROUP = {
  chest: 'chest', lats: 'back', 'middle back': 'back', 'lower back': 'back', traps: 'back', shoulders: 'shoulders',
  biceps: 'arms', triceps: 'arms', forearms: 'arms',
  quadriceps: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs', adductors: 'legs', abductors: 'legs',
  abdominals: 'core', neck: 'neck',
}

const SMALL = new Set(['a', 'an', 'and', 'on', 'with', 'to', 'of', 'the', 'in', 'at', 'from', 'over', 'for', 'or', 'v'])
const title = s => s.trim().replace(/\s+/g, ' ').split(' ')
  .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.replace(/^([("]?)(\p{L})/u, (_, p, c) => p + c.toUpperCase()))).join(' ')

const EQUIP_WORDS = new Set(['barbell', 'dumbbell', 'cable', 'machine', 'lever', 'leverage', 'smith', 'kettlebell',
  'body', 'weight', 'bodyweight', 'ez', 'bar', 'weighted', 'sled', 'with', 'using'])
const SYN = { db: 'dumbbell', dumbbells: 'dumbbell', bb: 'barbell', kb: 'kettlebell', kettlebells: 'kettlebell', lever: 'machine',
  leverage: 'machine', stability: 'exercise', swiss: 'exercise', ezbar: 'ez bar', 'e-z': 'ez', bodyweight: 'body weight', tricep: 'triceps', bicep: 'biceps', press: 'press' }
const STOP = new Set(['a', 'an', 'the', 'on', 'with', 'to', 'of', 'and', 'in', 'at'])

const NOISE = /\((male|female|back pov|side pov|with arm blaster|with rope|with rope attachment|rope attachment|v-bar|sz-bar|with barbell|equipment|pyramid)\)/gi
const SUFFIX = /\s+-\s+(medium grip|powerlifting|rope attachment|v-bar attachment)$/i

export function nameTokens(name) {
  const s = name.toLowerCase().replace(/['’]/g, '').replace(NOISE, ' ').replace(/[()]/g, ' ').replace(/-/g, ' ').replace(/[^a-z0-9 ]+/g, ' ')
  const out = []
  for (const w0 of s.split(/\s+/).filter(Boolean).flatMap(w => (SYN[w] ?? w).split(' '))) {
    if (STOP.has(w0)) continue
    const w = w0.length > 3 && w0.endsWith('s') && !w0.endsWith('ss') ? w0.slice(0, -1) : w0 === 'flye' ? 'fly' : w0
    if ((w === 'up' || w === 'ups') && out.length) out.push(`${out.pop()}up`)
    else out.push(w === 'flye' ? 'fly' : w)
  }
  const drop = new Set()
  if (out.includes('incline') || out.includes('decline')) drop.add('bench')
  if (out.includes('curl')) drop.add('bicep').add('biceps')
  return out.filter(w => !drop.has(w))
}
export const nameKey = name => [...new Set(nameTokens(name))].sort().join(' ')
const baseName = name => name.replace(SUFFIX, '')

const LOOSE = new Set(['machine', 'other'])
const STRICT = new Set(['smith', 'weighted'])
const RAW_KIND = { 'smith machine': 'smith', 'leverage machine': 'lever', 'sled machine': 'sled' }

export function equipKind(name, eq, raw = '') {
  const s = name.toLowerCase()
  const r = String(raw).toLowerCase()
  if (/\bsmith\b/.test(s) || r === 'smith machine') return 'smith'
  if (/\blever(age)?\b/.test(s) || r === 'leverage machine') return 'lever'
  if (eq === 'machine') return RAW_KIND[r] ?? (/\bsled\b/.test(s) ? 'sled' : r && r !== 'assisted' ? r : 'machine')
  if (eq === 'other' || eq === 'bodyweight') return /\bweighted\b/.test(s) || r === 'weighted' ? 'weighted' : eq === 'other' ? r || 'other' : eq
  return eq
}

export const sameEquipment = (a, b) => a === b || !STRICT.has(a) && !STRICT.has(b) && (LOOSE.has(a) || LOOSE.has(b))

const coreKey = name => [...new Set(nameTokens(name).filter(w => !EQUIP_WORDS.has(w)))].sort().join(' ')

export function dedupeIndex(existing) {
  const byKey = new Map()
  const byCore = new Map()
  for (const e of existing) {
    for (const n of new Set([e.n, baseName(e.n)])) {
      byKey.set(nameKey(n), e.id)
      const k = `${coreKey(n)}|${e.eq}`
      if (!byCore.has(k)) byCore.set(k, [])
      byCore.get(k).push({ id: e.id, kind: equipKind(n, e.eq), p0: e.p[0] ?? '' })
    }
  }
  return (n, eq, p0, raw = '') => {
    const named = byKey.get(nameKey(n))
    if (named) return named
    const core = coreKey(n)
    if (!core) return undefined
    const kind = equipKind(n, eq, raw)
    let hit
    for (const c of byCore.get(`${core}|${eq}`) ?? []) {
      if (sameEquipment(kind, c.kind) && (core.includes(' ') || c.p0 === (p0 ?? ''))) hit = c.id
    }
    return hit
  }
}

const mapMuscles = list => [...new Set(list.map(m => MUSCLE[String(m).toLowerCase().trim()]).filter(Boolean))]
const steps = (arr, text) => {
  const out = (Array.isArray(arr) ? arr : []).map(s => String(s).trim()).filter(Boolean)
  if (out.length) return out
  return String(text ?? '').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
}

export function convert(upstream, existing, i18n) {
  const dupOf = dedupeIndex(existing)
  const meta = []
  const en = {}
  const ru = {}
  const dropped = []
  const twins = []
  const seen = new Map()
  for (const x of upstream) {
    const id = `exdb_${String(x.id).replace(/[^0-9A-Za-z]/g, '')}`
    const eq = EQUIPMENT[String(x.equipment ?? '').toLowerCase()] ?? 'other'
    const p = mapMuscles([x.target].filter(Boolean))
    const s = mapMuscles(Array.isArray(x.secondary_muscles) ? x.secondary_muscles : []).filter(m => !p.includes(m))
    const n = title(String(x.name ?? id).replace(/в°/g, '°'))
    const dup = dupOf(n, eq, p[0], x.equipment)
    if (dup) { dropped.push([n, dup]); continue }
    const own = `${nameKey(n)}|${eq}`
    if (seen.has(own)) { twins.push([n, seen.get(own)]); continue }
    seen.set(own, id)
    const bp = String(x.body_part ?? '').toLowerCase()
    const c = bp === 'cardio' || p.length === 0 && /cardio/.test(String(x.target)) ? 'cardio'
      : /stretch/i.test(n) ? 'stretching' : /jump|hop|plyo|burpee/i.test(n) ? 'plyometrics' : 'strength'
    const row = { id, n, g: GROUP[p[0]] ?? 'other', eq, p, s, c, i: 0 }
    const tr = i18n[x.id]
    if (tr) { row.uz = tr.uz; row.ru = tr.ru; if (tr.a?.length) row.a = tr.a }
    meta.push(row)
    const e = steps(x.instruction_steps?.en, x.instructions?.en)
    if (e.length) en[id] = e
    const r = steps(x.instruction_steps?.ru, x.instructions?.ru)
    if (r.length) ru[id] = r
  }
  return { meta, en, ru, dropped, twins }
}

async function main() {
  const local = process.argv[2]
  const text = local ? readFileSync(local, 'utf8') : await (await fetch(URL_JSON)).text()
  const upstream = JSON.parse(text)
  const existing = JSON.parse(readFileSync('src/catalogue/data/exercises.json', 'utf8'))
  const i18n = JSON.parse(readFileSync('content/exdb-i18n.json', 'utf8'))
  const { meta, en, ru, dropped, twins } = convert(upstream, existing, i18n)
  if (process.env.EXDB_REPORT) writeFileSync(process.env.EXDB_REPORT, JSON.stringify({ dropped, twins }, null, 1))
  const known = new Set(upstream.map(x => x.id))
  const unknown = Object.keys(i18n).filter(id => !known.has(id))
  const droppedTr = Object.keys(i18n).filter(id => !meta.some(m => m.id === `exdb_${id}`))
  if (unknown.length || droppedTr.length) {
    console.error('content/exdb-i18n.json has ids that are unknown or deduped:', [...unknown, ...droppedTr].join(', '))
    process.exit(1)
  }
  const out = 'src/catalogue/data'
  writeFileSync(join(out, 'exdb.json'), JSON.stringify(meta))
  writeFileSync(join(out, 'exdb.steps.en.json'), JSON.stringify(en))
  writeFileSync(join(out, 'exdb.steps.ru.json'), JSON.stringify(ru))
  console.log(`exercises-dataset@${SHA.slice(0, 7)}: ${upstream.length} upstream, ${dropped.length} duplicates of free-exercise-db dropped, ${twins.length} view/sex variants merged, ` +
    `${meta.length} added, ${meta.filter(m => m.uz).length} with uz/ru names, steps en ${Object.keys(en).length}, ru ${Object.keys(ru).length}`)
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) await main()

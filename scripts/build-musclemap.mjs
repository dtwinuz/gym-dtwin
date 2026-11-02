#!/usr/bin/env node
// Converts melihcolpan/MuscleMap (MIT) Swift path tables into src/catalogue/data/body.json.
//   node scripts/build-musclemap.mjs <path-to-MuscleMap checkout>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const src = process.argv[2]
if (!src) {
  console.error('usage: node scripts/build-musclemap.mjs <MuscleMap dir>')
  process.exit(1)
}

const SUBGROUPS = new Set([
  'upperChest', 'lowerChest', 'innerQuad', 'outerQuad', 'upperAbs', 'lowerAbs',
  'frontDeltoid', 'rearDeltoid', 'upperTrapezius', 'lowerTrapezius',
])

const VIEWBOX = {
  male: { front: [0, 95, 727, 1280], back: [718, 95, 727, 1280] },
  female: { front: [0, 0, 650, 1450], back: [823, 0, 650, 1450] },
}

function parse(file) {
  const text = readFileSync(join(src, 'Sources/MuscleMap/Data', file), 'utf8')
  const parts = {}
  for (const block of text.split('BodyPartPathData(').slice(1)) {
    const slug = block.match(/slug:\s*\.(\w+)/)?.[1]
    if (!slug || SUBGROUPS.has(slug)) continue
    const paths = [...block.matchAll(/"([Mm][^"]+)"/g)].map(m => m[1])
    if (paths.length) (parts[slug] ??= []).push(...paths)
  }
  return parts
}

const body = {}
for (const g of ['male', 'female']) {
  body[g] = {}
  for (const side of ['front', 'back']) {
    const name = `${g[0].toUpperCase()}${g.slice(1)}${side[0].toUpperCase()}${side.slice(1)}Paths.swift`
    body[g][side] = { vb: VIEWBOX[g][side], parts: parse(name) }
  }
}

mkdirSync('src/catalogue/data', { recursive: true })
writeFileSync('src/catalogue/data/body.json', JSON.stringify(body))
for (const g of Object.keys(body)) for (const s of Object.keys(body[g])) console.log(g, s, Object.keys(body[g][s].parts).join(' '))

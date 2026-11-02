import type { CatalogueExercise } from './index'
import { EQUIPMENT_NAME, GROUP_NAME, MUSCLE_NAME } from './labels'

const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
}

/** Lowercase latin form: Cyrillic is transliterated, Uzbek o'/g' apostrophes and diacritics dropped. */
export function normalize(s: string): string {
  let out = ''
  for (const ch of s.toLowerCase().normalize('NFKD')) {
    if (ch in CYR) out += CYR[ch]
    else if (/[a-z0-9]/.test(ch)) out += ch
    else if (/[̀-ͯ'`ʻʼ’‘]/.test(ch)) continue
    else out += ' '
  }
  return out.replace(/kh/g, 'h').replace(/x/g, 'h').replace(/\s+/g, ' ').trim()
}

export const tokens = (s: string) => normalize(s).split(' ').filter(Boolean)

/** Gym words in uz/ru (both scripts) that map onto the English catalogue vocabulary. */
const SYN_RAW: Record<string, string> = {
  gantel: 'dumbbell', gantelya: 'dumbbell', ganteli: 'dumbbell', gantelyami: 'dumbbell',
  shtanga: 'barbell', shtangoy: 'barbell', shtangi: 'barbell', grif: 'barbell',
  girya: 'kettlebell', giri: 'kettlebell', gire: 'kettlebell',
  blok: 'cable', bloke: 'cable', bloka: 'cable', tros: 'cable', krossover: 'crossover',
  trenajor: 'machine', trenazher: 'machine', trenazhere: 'machine', smit: 'smith', smita: 'smith',
  jim: 'press', zhim: 'press', jimi: 'press',
  tyaga: 'row deadlift pulldown', tortish: 'row pulldown', tortilish: 'pullups chin',
  stanovaya: 'deadlift', stanovoy: 'deadlift', rumynskaya: 'romanian', rumin: 'romanian',
  prised: 'squat', prisedaniya: 'squat', prisedaniye: 'squat', otirib: 'squat',
  vypady: 'lunge', vypad: 'lunge', hamla: 'lunge',
  turnik: 'pullups chin', podtyagivaniya: 'pullups chin', podtyagivanie: 'pullups',
  brusya: 'dips', brusyah: 'dips', otjimaniya: 'pushups', otzhimaniya: 'pushups', otjimanie: 'pushups',
  bukish: 'curl', sgibanie: 'curl', sgibaniya: 'curl', podem: 'curl raise',
  razgibanie: 'extension', yozish: 'extension', razgibaniya: 'extension',
  razvodka: 'flyes fly', razvedenie: 'flyes raise', mahi: 'raise lateral', mah: 'raise',
  frantsuzskiy: 'skullcrusher triceps', fransuz: 'skullcrusher triceps',
  shrugi: 'shrug', shrag: 'shrug', giperekstenziya: 'hyperextensions', giper: 'hyperextensions',
  planka: 'plank', skrutichivaniya: 'crunch', skruchivaniya: 'crunch', pressa: 'crunch abdominals',
  kardio: 'cardio', beg: 'running', yugurish: 'running', dorojka: 'treadmill', dorozhka: 'treadmill',
  velo: 'bicycling', velosiped: 'bicycling', grebnoy: 'rowing', skakalka: 'rope jumping', arqon: 'rope',
  kokrak: 'chest', grud: 'chest', grudi: 'chest', orqa: 'back', spina: 'back', spiny: 'back',
  oyoq: 'leg', nogi: 'leg', nog: 'leg', yelka: 'shoulder', plechi: 'shoulder', delty: 'deltoid',
  biseps: 'biceps', bitseps: 'biceps', triseps: 'triceps', tritseps: 'triceps',
  boldir: 'calf', ikry: 'calf', ikr: 'calf', dumba: 'glute', yagoditsy: 'glute', yagodits: 'glute',
  qorin: 'abdominals crunch', press: 'press', skameyka: 'bench', skamya: 'bench', skame: 'bench',
  yotib: 'bench lying', lezha: 'bench lying', stoya: 'standing', sidya: 'seated', utirib: 'seated',
  naklon: 'bent incline', naklonnoy: 'incline', qiya: 'incline', obratnyy: 'reverse decline', teskari: 'reverse decline',
  ohp: 'shoulder military press', rdl: 'romanian deadlift', db: 'dumbbell', bb: 'barbell', kb: 'kettlebell',
  sit: 'sit', ab: 'abdominals', abs: 'abdominals crunch', lat: 'lat pulldown', lats: 'lat pulldown',
}
const SYN = new Map(Object.entries(SYN_RAW).map(([k, v]) => [normalize(k), v.split(' ')]))

export interface Doc {
  e: CatalogueExercise
  toks: string[]
  phrase: string
  names: string[]
  alias: Set<string>
}

export function buildIndex(list: CatalogueExercise[]): Doc[] {
  return list.map(e => {
    const parts = [e.n, e.uz ?? '', e.ru ?? '', ...(e.a ?? []), e.eq, e.g, ...e.p,
      ...Object.values(EQUIPMENT_NAME[e.eq] ?? {}), ...Object.values(GROUP_NAME[e.g] ?? {}),
      ...e.p.flatMap(m => Object.values(MUSCLE_NAME[m] ?? {}))]
    const toks = [...new Set(parts.flatMap(tokens))]
    const names = [e.n, e.uz, e.ru].filter(Boolean).map(s => normalize(s!))
    const alias = (e.a ?? []).map(normalize)
    return { e, toks, names, alias: new Set(alias), phrase: [...names, ...alias].join(' | ') }
  })
}

/** Optimal string alignment distance with an early exit above `max`. */
export function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const prev2 = new Array(b.length + 1).fill(0)
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1)
      cur[j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    for (let j = 0; j <= b.length; j++) prev2[j] = prev[j]
    prev = cur
  }
  return prev[b.length]
}

function tokenScore(q: string, t: string): number {
  if (t === q) return 3
  if (q.length >= 2 && t.startsWith(q)) return 2
  if (q.length >= 3 && t.includes(q)) return 1.2
  if (q.length >= 4) {
    const max = q.length >= 7 ? 2 : 1
    if (distance(q, t, max) <= max) return 1
    if (t.length > q.length && distance(q, t.slice(0, q.length), 1) <= 1) return 0.8
  }
  return 0
}

export interface RankHints {
  fav?: ReadonlySet<string>
  used?: ReadonlySet<string>
}

export function search(docs: Doc[], query: string, hints: RankHints = {}): CatalogueExercise[] {
  const q = tokens(query)
  if (!q.length) {
    const rank = (e: CatalogueExercise) => (hints.fav?.has(e.id) ? 4 : 0) + (hints.used?.has(e.id) ? 2 : 0) + (e.uz ? 1 : 0)
    return docs.map(d => d.e).sort((a, b) => rank(b) - rank(a))
  }
  const phrase = q.join(' ')
  const scored: { e: CatalogueExercise; s: number }[] = []
  for (const d of docs) {
    let total = 0
    let ok = true
    for (const qt of q) {
      const variants = [qt, ...(SYN.get(qt) ?? [])]
      let best = 0
      for (const v of variants) {
        const w = v === qt ? 1 : 0.9
        for (const t of d.toks) {
          const s = tokenScore(v, t) * w
          if (s > best) best = s
          if (best >= 3) break
        }
      }
      if (best === 0) { ok = false; break }
      total += best
    }
    if (!ok) continue
    if (d.phrase.includes(phrase)) total += 3
    if (d.names.some(n => n.startsWith(phrase))) total += 2
    if (d.alias.has(phrase) || d.names.includes(phrase)) total += 3
    if (hints.fav?.has(d.e.id)) total += 2
    if (hints.used?.has(d.e.id)) total += 1.5
    if (d.e.uz) total += 0.6
    const hit = d.names.filter(n => n.includes(phrase))
    total -= (hit.length ? Math.min(...hit.map(n => n.length)) : d.e.n.length) * 0.02
    scored.push({ e: d.e, s: total })
  }
  return scored.sort((a, b) => b.s - a.s).map(x => x.e)
}

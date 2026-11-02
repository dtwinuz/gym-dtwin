import raw from './data/exercises.json'
import exdb from './data/exdb.json'
import type { Lang } from '../i18n'
import type { Category, Equipment, Group, Level } from './labels'

export interface CatalogueExercise {
  id: string
  n: string
  uz?: string
  ru?: string
  a?: string[]
  g: Group
  eq: Equipment
  p: string[]
  s: string[]
  c: Category
  l?: Level
  m?: 'c' | 'i'
  f?: string
  i: number
  custom?: boolean
}

export const CATALOGUE = [...raw, ...exdb] as CatalogueExercise[]

const index = new Map(CATALOGUE.map(e => [e.id, e]))
let extra = new Map<string, CatalogueExercise>()

export function setCustomExercises(list: CatalogueExercise[]) {
  extra = new Map(list.map(e => [e.id, { ...e, custom: true }]))
}

export const exerciseById = (id: string) => index.get(id) ?? extra.get(id)
export const allExercises = () => (extra.size ? [...CATALOGUE, ...extra.values()] : CATALOGUE)

export function exerciseName(e: CatalogueExercise | undefined, lang: Lang) {
  if (!e) return '?'
  return (lang === 'uz' ? e.uz : lang === 'ru' ? e.ru : undefined) ?? e.n
}

export const imageUrl = (id: string, n: number) => `/ex/${id}/${n}.webp`

type Steps = Record<string, string[]>
type Source = 'base' | 'exdb'
const loaders: Record<`${Source}.${Lang}`, () => Promise<{ default: Steps }>> = {
  'base.en': () => import('./data/steps.en.json'),
  'base.uz': () => import('./data/steps.uz.json'),
  'base.ru': () => import('./data/steps.ru.json'),
  'exdb.en': () => import('./data/exdb.steps.en.json'),
  'exdb.uz': async () => ({ default: {} }),
  'exdb.ru': () => import('./data/exdb.steps.ru.json'),
}
const cache: Partial<Record<string, Steps>> = {}

export const isExdb = (id: string) => id.startsWith('exdb_')

export async function loadSteps(lang: Lang, source: Source = 'base'): Promise<Steps> {
  const key = `${source}.${lang}` as const
  return (cache[key] ??= (await loaders[key]()).default)
}

/** Steps in the wanted language, falling back to English. */
export async function exerciseSteps(id: string, lang: Lang): Promise<{ lang: Lang; steps: string[] }> {
  const source: Source = isExdb(id) ? 'exdb' : 'base'
  if (lang !== 'en') {
    const local = (await loadSteps(lang, source))[id]
    if (local?.length) return { lang, steps: local }
  }
  return { lang: 'en', steps: (await loadSteps('en', source))[id] ?? [] }
}

/** Exercises that train the same primary muscle, compound first. */
export function similarExercises(id: string, limit = 6) {
  const e = exerciseById(id)
  if (!e?.p[0]) return []
  return allExercises()
    .filter(x => x.id !== id && x.p[0] === e.p[0] && x.c === e.c)
    .sort((a, b) => Number(!!b.uz) - Number(!!a.uz) || (a.m === 'c' ? -1 : 0) - (b.m === 'c' ? -1 : 0))
    .slice(0, limit)
}

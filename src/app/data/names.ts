import { CATALOGUE, type CatalogueExercise } from '../../catalogue'
import type { Equipment } from '../../catalogue/labels'
import { buildIndex, normalize, search, tokens } from '../../catalogue/search'
import type { CustomExercise } from '../../core/types'
import { customToCatalogue } from '../custom'
import type { Tick } from './csv'

const EQUIPMENT_WORDS: Record<string, { word: string; eq?: Equipment }> = {
  barbell: { word: 'barbell', eq: 'barbell' },
  dumbbell: { word: 'dumbbell', eq: 'dumbbell' },
  machine: { word: 'machine', eq: 'machine' },
  'smith machine': { word: 'smith machine', eq: 'machine' },
  cable: { word: 'cable', eq: 'cable' },
  kettlebell: { word: 'kettlebell', eq: 'kettlebell' },
  band: { word: 'band', eq: 'band' },
  'resistance band': { word: 'band', eq: 'band' },
  'ez bar': { word: 'ez bar', eq: 'ez bar' },
  'ez curl bar': { word: 'ez bar', eq: 'ez bar' },
  bodyweight: { word: '', eq: 'bodyweight' },
  'body weight': { word: '', eq: 'bodyweight' },
  'bodyweight only': { word: '', eq: 'bodyweight' },
  weighted: { word: '' },
  assisted: { word: 'assisted' },
}

export interface CleanName {
  /** The name without a trailing equipment bracket. */
  base: string
  equipment?: Equipment
  /** Words for the catalogue search, equipment first as its names have it. */
  query: string
}

/** "Bench Press (Barbell)" -> base "Bench Press", equipment barbell, query "barbell Bench Press". */
export function cleanName(raw: string): CleanName {
  const name = raw.trim()
  const m = /^(.*\S)\s*\(([^()]*)\)$/.exec(name)
  const known = m && EQUIPMENT_WORDS[m[2].trim().toLowerCase()]
  if (!m || !known) return { base: name, query: name }
  const out: CleanName = { base: m[1], query: `${known.word} ${m[1]}`.trim() }
  if (known.eq) out.equipment = known.eq
  return out
}

const ALIASES_RAW: Record<string, string[]> = {
  'Barbell_Bench_Press_-_Medium_Grip': ['Bench Press (Barbell)', 'Bench Press', 'Flat Bench Press'],
  'Barbell_Incline_Bench_Press_-_Medium_Grip': ['Incline Bench Press (Barbell)', 'Incline Bench Press'],
  Decline_Barbell_Bench_Press: ['Decline Bench Press (Barbell)'],
  Dumbbell_Bench_Press: ['Bench Press (Dumbbell)'],
  Incline_Dumbbell_Press: ['Incline Bench Press (Dumbbell)', 'Incline Press (Dumbbell)'],
  Barbell_Squat: ['Squat (Barbell)', 'Squat', 'Back Squat', 'Back Squat (Barbell)'],
  Front_Barbell_Squat: ['Front Squat (Barbell)', 'Front Squat'],
  Barbell_Deadlift: ['Deadlift (Barbell)', 'Deadlift', 'Conventional Deadlift'],
  Romanian_Deadlift: ['Romanian Deadlift (Barbell)', 'Romanian Deadlift', 'RDL'],
  Standing_Military_Press: ['Overhead Press (Barbell)', 'Overhead Press', 'Shoulder Press (Barbell)', 'Military Press', 'OHP'],
  Dumbbell_Shoulder_Press: ['Overhead Press (Dumbbell)', 'Shoulder Press (Dumbbell)', 'Seated Shoulder Press (Dumbbell)'],
  Bent_Over_Barbell_Row: ['Bent Over Row (Barbell)', 'Barbell Row', 'Row (Barbell)'],
  'One-Arm_Dumbbell_Row': ['Bent Over One Arm Row (Dumbbell)', 'Dumbbell Row', 'Row (Dumbbell)'],
  'Wide-Grip_Lat_Pulldown': ['Lat Pulldown (Cable)', 'Lat Pulldown (Machine)', 'Lat Pulldown'],
  Seated_Cable_Rows: ['Seated Row (Cable)', 'Seated Row (Machine)', 'Seated Cable Row', 'Seated Row'],
  Pullups: ['Pull Up', 'Pull Up (Bodyweight)', 'Pull-Up', 'Pull Ups', 'Pullup'],
  'Chin-Up': ['Chin Up', 'Chin Up (Bodyweight)', 'Chin Ups'],
  Pushups: ['Push Up', 'Push Up (Bodyweight)', 'Push-Up', 'Push Ups', 'Pushup'],
  Barbell_Curl: ['Bicep Curl (Barbell)', 'Biceps Curl (Barbell)', 'Curl (Barbell)'],
  Dumbbell_Bicep_Curl: ['Bicep Curl (Dumbbell)', 'Biceps Curl (Dumbbell)', 'Curl (Dumbbell)'],
  Hammer_Curls: ['Hammer Curl (Dumbbell)', 'Hammer Curl'],
  Triceps_Pushdown: ['Triceps Pushdown (Cable)', 'Triceps Pushdown', 'Tricep Pushdown'],
  'Triceps_Pushdown_-_Rope_Attachment': ['Triceps Rope Pushdown', 'Triceps Pushdown (Rope)'],
  Side_Lateral_Raise: ['Lateral Raise (Dumbbell)', 'Lateral Raise', 'Side Lateral Raise (Dumbbell)'],
  Face_Pull: ['Face Pull (Cable)'],
  Leg_Press: ['Leg Press (Machine)'],
  Leg_Extensions: ['Leg Extension (Machine)', 'Leg Extension'],
  Lying_Leg_Curls: ['Lying Leg Curl (Machine)', 'Leg Curl (Machine)', 'Leg Curl'],
  Seated_Leg_Curl: ['Seated Leg Curl (Machine)'],
  Standing_Calf_Raises: ['Standing Calf Raise (Machine)', 'Standing Calf Raise', 'Calf Raise (Machine)', 'Calf Raise'],
  Seated_Calf_Raise: ['Seated Calf Raise (Machine)'],
  Barbell_Hip_Thrust: ['Hip Thrust (Barbell)', 'Hip Thrust'],
  Dumbbell_Lunges: ['Lunge (Dumbbell)', 'Lunges (Dumbbell)'],
  Crunches: ['Crunch', 'Crunch (Bodyweight)'],
  Barbell_Shrug: ['Shrug (Barbell)'],
  Dumbbell_Shrug: ['Shrug (Dumbbell)'],
  Running_Treadmill: ['Running', 'Running (Treadmill)', 'Treadmill', 'Treadmill Running'],
  Walking_Treadmill: ['Walking'],
  Bicycling_Stationary: ['Cycling', 'Cycling (Indoor)', 'Bike (Stationary)'],
  Rowing_Stationary: ['Rowing (Machine)', 'Rowing'],
  'Dips_-_Triceps_Version': ['Triceps Dip', 'Triceps Dip (Bodyweight)', 'Dip', 'Dips'],
  'Dips_-_Chest_Version': ['Chest Dip', 'Chest Dip (Bodyweight)'],
}

export const NAME_ALIASES = new Map(Object.entries(ALIASES_RAW).flatMap(([id, names]) => names.map(n => [normalize(n), id] as const)))

export type Confidence = 'high' | 'low' | 'none'

export interface NameMatch {
  name: string
  /** Best catalogue or existing custom exercise; absent = nothing close. */
  exId?: string
  confidence: Confidence
  equipment?: Equipment
}

const stem = (t: string) => t.replace(/s$/, '')
const SURE = 0.8
const LOOK_AT = 8

function similarity(q: string, candidate: string) {
  const a = new Set(tokens(q).map(stem))
  const b = new Set(tokens(candidate).map(stem))
  let both = 0
  for (const t of a) if (b.has(t)) both++
  const all = a.size + b.size - both
  return all ? both / all : 0
}

const best = (list: CatalogueExercise[], q: string) => {
  let top: { e: CatalogueExercise; s: number } | null = null
  for (const e of list.slice(0, LOOK_AT)) {
    const s = similarity(q, e.n)
    if (!top || s > top.s) top = { e, s }
  }
  return top
}

export function matcher(customEx: CustomExercise[]) {
  const own = customEx.map(customToCatalogue)
  const exact = new Map<string, string>()
  for (const e of CATALOGUE) {
    for (const n of [e.n, e.uz, e.ru, ...(e.a ?? [])]) if (n) exact.set(normalize(n), e.id)
  }
  for (const e of own) exact.set(normalize(e.n), e.id)
  const docs = buildIndex([...CATALOGUE, ...own])

  return (name: string): NameMatch => {
    const clean = cleanName(name)
    const base: Pick<NameMatch, 'name' | 'equipment'> = clean.equipment ? { name, equipment: clean.equipment } : { name }
    const known = exact.get(normalize(name)) ?? NAME_ALIASES.get(normalize(name)) ?? exact.get(normalize(clean.query))
    if (known) return { ...base, exId: known, confidence: 'high' }
    const hit = best(search(docs, clean.query), clean.query) ?? best(search(docs, clean.base), clean.query)
    if (!hit) return { ...base, confidence: 'none' }
    return { ...base, exId: hit.e.id, confidence: hit.s >= SURE ? 'high' : 'low' }
  }
}

export async function matchNames(names: string[], customEx: CustomExercise[], tick: Tick = async () => {}): Promise<NameMatch[]> {
  const match = matcher(customEx)
  const out: NameMatch[] = []
  for (let i = 0; i < names.length; i++) {
    out.push(match(names[i]))
    await tick(i)
  }
  return out
}

import { workoutVolume } from '../core/history'
import type { CustomExercise, Entry, Ms, Profile, WeighIn, Workout } from '../core/types'
import { emptyProfile, type Lang } from './profile'

/** Exercise ids of the first app version -> free-exercise-db ids. */
export const LEGACY_EX: Record<string, string> = {
  bench: 'Barbell_Bench_Press_-_Medium_Grip',
  'incline-db': 'Incline_Dumbbell_Press',
  fly: 'Cable_Crossover',
  dips: 'Dips_-_Chest_Version',
  pushup: 'Pushups',
  deadlift: 'Barbell_Deadlift',
  row: 'Bent_Over_Barbell_Row',
  pullup: 'Pullups',
  lat: 'Wide-Grip_Lat_Pulldown',
  'seated-row': 'Seated_Cable_Rows',
  'db-row': 'One-Arm_Dumbbell_Row',
  squat: 'Barbell_Squat',
  'front-squat': 'Front_Barbell_Squat',
  rdl: 'Romanian_Deadlift',
  'leg-press': 'Leg_Press',
  lunge: 'Dumbbell_Lunges',
  'leg-curl': 'Lying_Leg_Curls',
  calf: 'Standing_Calf_Raises',
  ohp: 'Standing_Military_Press',
  'db-shoulder': 'Dumbbell_Shoulder_Press',
  lateral: 'Side_Lateral_Raise',
  'face-pull': 'Face_Pull',
  curl: 'Barbell_Curl',
  hammer: 'Hammer_Curls',
  pushdown: 'Triceps_Pushdown',
  skull: 'EZ-Bar_Skullcrusher',
  plank: 'Plank',
  'hanging-raise': 'Hanging_Leg_Raise',
  'cable-crunch': 'Cable_Crunch',
}

export const legacyExId = (id: string) => LEGACY_EX[id] ?? id

export interface LegacyState {
  lang?: Lang
  planId?: string
  workouts?: { id: string; date: string; planId?: string; dayName?: string; sets: { exId: string; kg: number; reps: number }[] }[]
  bodyWeight?: { date: string; kg: number }[]
  goalKg?: number
  favEx?: string[]
  customEx?: { id: string; n: string; g: string; eq: string; p: string[]; s: string[]; c: string }[]
  gear?: string[] | null
  figure?: 'male' | 'female'
}

const noon = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, 12).getTime()
}

export function migrateLegacy(old: LegacyState, now: Ms = Date.now()): Profile {
  const p = emptyProfile(now, old.lang)
  if (old.figure) p.settings.body = old.figure

  p.workouts = (old.workouts ?? []).map((w): Workout => {
    const entries: Entry[] = []
    for (const s of w.sets ?? []) {
      const exId = legacyExId(s.exId)
      let e = entries.find(x => x.exId === exId)
      if (!e) entries.push((e = { exId, sets: [] }))
      e.sets.push({ w: s.kg, r: s.reps, done: true })
    }
    const t = noon(w.date)
    return {
      id: w.id, date: w.date, start: t, end: t, routineIds: w.planId ? [w.planId] : [], name: w.dayName ?? '',
      entries, prs: [], vol: workoutVolume(entries), updatedAt: now,
    }
  })

  p.bodyweight = (old.bodyWeight ?? []).map((b): WeighIn => ({ date: b.date, w: b.kg, t: noon(b.date) }))
  p.targetW = old.goalKg ?? null
  p.customEx = (old.customEx ?? []).map((c): CustomExercise => ({
    id: c.id, name: c.n, bodyPart: c.g, equipment: c.eq, primary: c.p, secondary: c.s, category: c.c, updatedAt: now,
  }))
  p.favEx = (old.favEx ?? []).map(legacyExId)
  p.gear = old.gear ?? null
  p.planId = old.planId
  return p
}

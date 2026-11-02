import { planById } from '../data'
import { exerciseById, exerciseName } from '../catalogue'
import type { Profile, SetRow, Workout } from '../core/types'
import { legacyExId } from './legacy'
import type { Lang } from './profile'

export const DEFAULT_PLAN = 'ppl'

export const starterPlan = (p: Profile) => planById(p.planId ?? DEFAULT_PLAN)

export function starterDay(p: Profile) {
  const plan = starterPlan(p)
  const done = p.workouts.filter(w => w.routineIds.includes(plan.id)).length
  return plan.days[done % plan.days.length]
}

export const starterExName = (oldId: string, lang: Lang) => exerciseName(exerciseById(legacyExId(oldId)), lang)

export function lastWorkSet(workouts: Workout[], exId: string): SetRow | undefined {
  const sorted = [...workouts].sort((a, b) => b.start - a.start)
  for (const w of sorted) {
    const e = w.entries.find(x => x.exId === exId)
    const s = e?.sets.filter(x => x.done && !x.warmup).at(-1)
    if (s) return s
  }
}

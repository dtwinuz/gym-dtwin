import raw from '../../content/programs.json'
import { REST } from '../core/schedule'
import type { Ms, Policy, Profile, Routine, Slot } from '../core/types'
import { mergeSchedule, newId, type IncomingSchedule } from './plan'
import { deleteItem, type Lang } from './profile'

type Text = Record<Lang, string>

export interface ProgramRoutine {
  id: string
  name: Text
  glyph?: string
  prog?: Policy
  ex: Slot[]
}

export interface Program {
  id: string
  days: number
  level: 'beginner' | 'intermediate'
  goal: 'hypertrophy' | 'strength' | 'general'
  place: 'gym' | 'home'
  name: Text
  desc: Text
  schedule: 'week' | 'rotation'
  week?: Record<string, string[]>
  rotation?: string[]
  routines: ProgramRoutine[]
}

export const PROGRAMS = (raw as unknown as { programs: Program[] }).programs

export const programById = (id: string) => PROGRAMS.find(x => x.id === id)

export type InstallMode = 'replace' | 'add'

/** Turn a program into the user's own routines and schedule. */
export function installProgram(p: Profile, prog: Program, lang: Lang, mode: InstallMode = 'replace', now: Ms = Date.now(), makeId = newId): Profile {
  const ids = new Map<string, string>()
  const routines: Routine[] = prog.routines.map(r => {
    const id = makeId()
    ids.set(r.id, id)
    return { id, name: r.name[lang], glyph: r.glyph, prog: r.prog, ex: structuredClone(r.ex), updatedAt: now }
  })
  const remap = (id: string) => (id === REST ? REST : ids.get(id) ?? '')
  const inc: IncomingSchedule = prog.schedule === 'rotation'
    ? { sequence: (prog.rotation ?? []).map(remap).filter(Boolean) }
    : { week: Object.fromEntries(Object.entries(prog.week ?? {}).map(([d, list]) => [Number(d), list.map(remap).filter(Boolean)])) }
  const onboardedAt = p.onboardedAt ?? now

  if (mode === 'add') return { ...mergeSchedule(p, inc, now), routines: [...p.routines, ...routines], planId: p.planId ?? prog.id, onboardedAt }

  const cleared = p.routines.reduce((acc, r) => deleteItem(acc, 'routines', r.id, now), p)
  return {
    ...cleared,
    routines,
    planId: prog.id,
    onboardedAt,
    dayPlan: {},
    week: inc.week ?? {},
    scheduleMode: inc.sequence ? 'rotation' : 'week',
    rotation: inc.sequence ? { id: makeId(), sequence: inc.sequence, since: now } : null,
  }
}

export interface Answers {
  goal: 'strength' | 'muscle' | 'fitness'
  level: 'beginner' | 'intermediate'
  days: number
  place: 'gym' | 'home'
}

export function recommendProgram({ goal, level, days, place }: Answers): Program {
  const pick = (id: string) => programById(id) ?? PROGRAMS[0]
  if (place === 'home') return pick('home-dumbbells')
  const seasoned = level === 'intermediate'
  if (goal === 'strength') return pick(seasoned && days >= 4 ? 'upper-lower' : 'five-by-five')
  if (goal === 'muscle') {
    if (seasoned && days >= 5) return pick('ppl')
    return pick(days >= 4 ? 'upper-lower' : 'full-body')
  }
  if (!seasoned) return pick('beginner-machines')
  return pick(days >= 4 ? 'upper-lower' : 'full-body')
}

const LEGACY_PLANS: Record<string, string> = { ppl: 'ppl', 'upper-lower': 'upper-lower', 'full-body': 'full-body', '5x5': 'five-by-five' }

/** The program matching a plan picked in the first app version. */
export const legacyProgram = (planId?: string) => (planId ? programById(LEGACY_PLANS[planId] ?? '') : undefined)

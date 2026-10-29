import { useSyncExternalStore } from 'react'
import { planById } from './data'
import type { Lang } from './i18n'

export interface LoggedSet {
  exId: string
  kg: number
  reps: number
}

export interface Workout {
  id: string
  date: string
  planId: string
  dayName: string
  sets: LoggedSet[]
}

export interface BodyWeight {
  date: string
  kg: number
}

export interface State {
  lang: Lang
  planId: string
  workouts: Workout[]
  bodyWeight: BodyWeight[]
  goalKg: number
}

const KEY = 'gym-dtwin:v1'

const initial: State = { lang: 'uz', planId: 'ppl', workouts: [], bodyWeight: [], goalKg: 75 }

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...initial, ...JSON.parse(raw) } : initial
  } catch {
    return initial
  }
}

let state = load()
const listeners = new Set<() => void>()

export function update(fn: (s: State) => State) {
  state = fn(state)
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // storage unavailable (private mode) — keep in memory only
  }
  listeners.forEach(l => l())
}

export function useStore(): State {
  return useSyncExternalStore(
    cb => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

export const today = () => new Date().toISOString().slice(0, 10)

/** Epley formula: estimated one-rep max. */
export const e1rm = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30))

export function bestE1rm(workouts: Workout[], exId: string, before?: string) {
  let best = 0
  for (const w of workouts) {
    if (before && w.date >= before) continue
    for (const s of w.sets) if (s.exId === exId) best = Math.max(best, e1rm(s.kg, s.reps))
  }
  return best
}

export function lastSet(workouts: Workout[], exId: string): LoggedSet | undefined {
  for (let i = workouts.length - 1; i >= 0; i--) {
    const s = workouts[i].sets.find(x => x.exId === exId)
    if (s) return s
  }
}

export function nextDay(planId: string, workoutsInPlan: number) {
  const plan = planById(planId)
  return plan.days[workoutsInPlan % plan.days.length]
}

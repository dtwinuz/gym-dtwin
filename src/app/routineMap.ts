import { exerciseById, setCustomExercises } from '../catalogue'
import { loadLevels, muscleWeights } from '../core/muscles'
import type { CustomExercise, Slot } from '../core/types'
import { customToCatalogue } from './custom'

/** Muscle -> 0..1 intensity of a list of slots, weighted by sets. */
export function slotLevels(ex: Slot[]): Record<string, number> {
  const load: Record<string, number> = {}
  for (const s of ex) {
    const e = exerciseById(s.exId)
    if (!e) continue
    for (const [m, k] of Object.entries(muscleWeights({ primary: e.p, secondary: e.s }))) load[m] = (load[m] ?? 0) + k * s.sets
  }
  return Object.fromEntries(Object.entries(loadLevels(load)).map(([m, v]) => [m, v / 4]))
}

let synced: CustomExercise[] | null = null

/** Makes the user's own exercises resolvable before the page reads them. */
export function useCustomExercises(list: CustomExercise[]) {
  if (synced === list) return
  synced = list
  setCustomExercises(list.map(customToCatalogue))
}

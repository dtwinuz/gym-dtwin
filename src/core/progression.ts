import type { Entry, Mode, Policy, Rx, SetRow, Slot } from './types'
import { clean, floorTo } from './units'

export const DELOAD_FACTOR = 0.9
/** Consecutive missed sessions at one weight before a deload. */
export const STALL_LIMIT: Record<Policy, number> = { off: Infinity, linear: 3, greyskull: 1, double: 3, triple: 3, time: 3 }
export const SEC_STEP = 5
export const MAX_BW_SETS = 6
export const MAX_TRIPLE_SETS = 10

/** What the app asks for in the next session of one exercise. */
export interface Prescription extends Rx {
  why: Why
}

export type Why =
  | 'first' // no history yet: the routine's numbers
  | 'plan' // the routine changed since last time: hold the weight, new targets
  | 'hold' // missed last time: same again
  | 'off' // progression off: same targets, last weight
  | 'load' // all reps made: more weight
  | 'reps' // all reps made: more reps (rep range / bodyweight)
  | 'set' // top of the range: one more set
  | 'time' // hold made: more seconds
  | 'deload' // stalled: lighter and build back

export const modeOf = (slot: Pick<Slot, 'mode' | 'min' | 'speed' | 'sec'>): Mode =>
  slot.mode ?? (slot.min != null || slot.speed != null ? 'cardio' : slot.sec != null ? 'time' : 'reps')

export function allowedPolicies(mode: Mode): Policy[] {
  if (mode === 'cardio') return ['off']
  if (mode === 'time') return ['off', 'time']
  return ['off', 'linear', 'greyskull', 'double', 'triple']
}

export function policyOf(slot: Slot, routinePolicy?: Policy): Policy {
  const mode = modeOf(slot)
  if (slot.pyramid?.length) return 'off'
  const p = slot.prog ?? routinePolicy ?? (mode === 'time' ? 'time' : mode === 'cardio' ? 'off' : 'linear')
  return allowedPolicies(mode).includes(p) ? p : 'off'
}

/** Bottom of the rep range: explicit, else top − 2 (min 1). */
export const repsBottom = (slot: Slot) => Math.max(1, Math.min(slot.repsMin ?? slot.reps - 2, slot.reps))

const workSets = (e: Entry) => e.sets.filter(s => !s.warmup && s.done)

export interface SessionRead {
  /** Every planned work set reached its goal. */
  ok: boolean
  weight: number
  low: number
  amrap: number
  sec: number
  setsDone: number
}

/** Judge one logged session against what it asked for. Warm-ups never count. */
export function readSession(e: Entry): SessionRead | null {
  const sets = workSets(e)
  if (!sets.length) return null
  const rx = e.rx
  const goalReps = rx?.reps ?? e.target?.reps ?? 0
  const goalSec = rx?.sec ?? e.target?.sec ?? 0
  const planned = rx?.sets ?? e.target?.sets ?? sets.length
  const judged = sets.slice(0, planned)
  const reps = (s: SetRow) => s.r ?? 0
  const okSet = (s: SetRow) => (goalSec > 0 ? (s.sec ?? 0) >= goalSec : reps(s) >= goalReps)
  return {
    ok: judged.length >= planned && judged.every(okSet),
    weight: Math.max(...sets.map(s => s.w ?? 0)),
    low: Math.min(...judged.map(reps)),
    amrap: reps(judged[judged.length - 1]),
    sec: Math.min(...judged.map(s => s.sec ?? 0)),
    setsDone: judged.length,
  }
}

const PLAN_KEYS = ['sets', 'reps', 'repsMin', 'sec', 'setsMax'] as const

export function planChanged(a: Slot | undefined, b: Slot) {
  if (!a) return false
  return PLAN_KEYS.some(k => (a[k] ?? null) !== (b[k] ?? null))
}

/**
 * Missed sessions in a row at the current weight under the current plan.
 * A success, a weight change or a plan change ends the run.
 */
export function stallCount(history: Entry[], slot: Slot): number {
  let n = 0
  let weight: number | null = null
  for (let i = history.length - 1; i >= 0; i--) {
    const e = history[i]
    if (e.noProg) continue
    if (planChanged(e.target, slot)) break
    const r = readSession(e)
    if (!r) continue
    if (weight == null) weight = r.weight
    if (r.weight !== weight || r.ok) break
    n++
  }
  return n
}

export interface ProgressionInput {
  slot: Slot
  /** Prior sessions of this exercise, oldest first. */
  history: Entry[]
  policy: Policy
  inc: number
}

/** Decide the next session's sets, reps and load. Pure: same input, same answer. */
export function nextPrescription({ slot, history, policy, inc }: ProgressionInput): Prescription {
  const base: Prescription = { sets: slot.sets, reps: slot.reps, weight: slot.weight, sec: slot.sec, why: 'first' }
  if (policy === 'double' || policy === 'triple') base.reps = repsBottom(slot)

  const usable = history.filter(e => !e.noProg)
  const last = usable[usable.length - 1]
  const read = last && readSession(last)
  if (!last || !read) return base

  const prevRx: Rx = last.rx ?? { ...base, weight: read.weight }
  const held: Prescription = { ...prevRx, weight: read.weight, why: 'hold' }

  if (planChanged(last.target, slot)) {
    return { ...base, weight: read.weight, why: 'plan' }
  }
  if (policy === 'off') return { sets: slot.sets, reps: slot.reps, sec: slot.sec, weight: read.weight, why: 'off' }

  const stalls = stallCount(usable, slot)
  const sign = slot.assisted ? -1 : 1
  const up = (w: number) => clean(Math.max(0, w + sign * inc))

  if (policy === 'time') {
    const sec = prevRx.sec ?? slot.sec ?? 30
    if (read.ok) return { ...held, sec: sec + SEC_STEP, why: 'time' }
    if (stalls >= STALL_LIMIT.time) return { ...held, sec: Math.max(SEC_STEP, sec - SEC_STEP), why: 'deload' }
    return held
  }

  const bodyweight = slot.bodyweight && read.weight <= 0
  if (bodyweight) {
    if (!read.ok) return held
    const top = slot.reps
    if (prevRx.reps >= top) {
      if (prevRx.sets >= MAX_BW_SETS) return { ...held, why: 'hold' }
      return { ...held, sets: prevRx.sets + 1, reps: repsBottom(slot), why: 'set' }
    }
    return { ...held, reps: prevRx.reps + (slot.side ? 2 : 1), why: 'reps' }
  }

  if (!read.ok) {
    if (stalls >= STALL_LIMIT[policy]) return { ...held, weight: deload(read, slot, inc), reps: policy === 'double' || policy === 'triple' ? repsBottom(slot) : held.reps, why: 'deload' }
    return held
  }

  switch (policy) {
    case 'linear':
      return { ...held, weight: up(read.weight), why: 'load' }
    case 'greyskull': {
      const jump = read.amrap >= 2 * prevRx.reps ? 2 : 1
      return { ...held, weight: clean(Math.max(0, read.weight + sign * inc * jump)), why: 'load' }
    }
    case 'double': {
      const top = slot.reps
      if (read.low >= top) return { ...held, weight: up(read.weight), reps: repsBottom(slot), why: 'load' }
      return { ...held, reps: Math.min(top, Math.max(repsBottom(slot), read.low + 1)), why: 'reps' }
    }
    case 'triple': {
      const top = slot.reps
      const setsMax = Math.min(slot.setsMax ?? slot.sets + 2, MAX_TRIPLE_SETS)
      if (prevRx.reps < top) return { ...held, reps: Math.min(top, prevRx.reps + 1), why: 'reps' }
      if (prevRx.sets < setsMax) return { ...held, sets: prevRx.sets + 1, why: 'set' }
      return { ...held, weight: up(read.weight), sets: slot.sets, reps: repsBottom(slot), why: 'load' }
    }
  }
}

/** Lighter weight after a stall: w × factor on the increment grid, always at least one step down. */
export function deload(read: SessionRead, slot: Slot, inc: number): number {
  const w = read.weight
  if (slot.assisted) return clean(w + inc)
  const step = inc > 0 ? inc : 1
  let to = floorTo(w * (slot.deloadFactor ?? DELOAD_FACTOR), step)
  if (to >= w) to = w - step
  return clean(Math.max(step, to))
}

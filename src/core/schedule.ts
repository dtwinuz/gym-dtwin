import { addDays, isoDate, parseIso, sortByStart, weekKey } from './history'
import type { ISODate, Profile, Rotation, Workout } from './types'

export const REST = 'rest'

export interface RotationState {
  /** Index into the sequence of the next routine to do (never a rest). */
  next: number
  /** Date of the last workout that advanced the loop. */
  lastDate: ISODate | null
  /** Rest entries between the last credited routine and the next one. */
  restsBefore: number
}

const nextRoutineIndex = (seq: string[], from: number) => {
  for (let k = 0; k < seq.length; k++) {
    const i = (from + k) % seq.length
    if (seq[i] !== REST) return i
  }
  return -1
}

/**
 * Replay workouts since the loop started. A workout credits the loop when it
 * contains the routine that is up next; anything else (an extra session, a
 * different routine) leaves the loop where it is.
 */
export function rotationState(rot: Rotation, workouts: Workout[]): RotationState {
  const seq = rot.sequence
  let pos = 0
  let lastDate: ISODate | null = null
  for (const w of sortByStart(workouts)) {
    if (w.start < rot.since) continue
    const i = nextRoutineIndex(seq, pos)
    if (i < 0) break
    if (w.routineIds.includes(seq[i])) {
      pos = (i + 1) % seq.length
      lastDate = w.date
    }
  }
  const next = nextRoutineIndex(seq, pos)
  let restsBefore = 0
  for (let k = pos; seq.length && seq[k % seq.length] === REST && restsBefore < seq.length; k++) restsBefore++
  return { next, lastDate, restsBefore }
}

/** What the loop asks for on `iso`: a routine id, 'rest', or null when the loop is empty. */
export function rotationForDay(rot: Rotation, workouts: Workout[], iso: ISODate): string | null {
  const st = rotationState(rot, workouts)
  if (st.next < 0) return null
  if (st.lastDate && st.restsBefore > 0) {
    const firstDue = addDays(st.lastDate, 1 + st.restsBefore)
    if (iso > st.lastDate && iso < firstDue) return REST
  }
  return rot.sequence[st.next]
}

/** Routines planned for a date: a day override wins, then the week (or the loop for today). */
export function routinesForDay(p: Profile, iso: ISODate, todayIso = isoDate(new Date())): string[] {
  const over = p.dayPlan[iso]
  if (over === REST) return []
  if (over) return [over]
  if (p.scheduleMode === 'rotation' && p.rotation) {
    if (iso !== todayIso) return []
    const r = rotationForDay(p.rotation, p.workouts, iso)
    return r && r !== REST ? [r] : []
  }
  return (p.week[parseIso(iso).getDay()] ?? []).filter(id => p.routines.some(r => r.id === id))
}

export const workoutsOn = (workouts: Workout[], iso: ISODate) => workouts.filter(w => w.date === iso)

/** The next day after `fromIso` (exclusive) with something planned in the fixed week. */
export function nextPlannedDay(p: Profile, fromIso: ISODate, horizon = 14): { date: ISODate; routineIds: string[] } | null {
  for (let i = 1; i <= horizon; i++) {
    const d = addDays(fromIso, i)
    const ids = p.scheduleMode === 'rotation' ? [] : routinesForDay(p, d, fromIso)
    if (ids.length) return { date: d, routineIds: ids }
  }
  return null
}

/** done / planned sessions in the week containing `now`. */
export function weekTally(p: Profile, now = new Date()) {
  const start = weekKey(now, p.settings.weekStart)
  const end = addDays(start, 6)
  const total = p.workouts.filter(w => w.date >= start && w.date <= end).length
  if (p.scheduleMode === 'rotation') return { planned: 0, done: total, total }
  let planned = 0
  let done = 0
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i)
    const ids = routinesForDay(p, d, isoDate(now))
    planned += ids.length
    // a planned day counts as done when it has at least as many workouts, whatever they were
    done += Math.min(ids.length, workoutsOn(p.workouts, d).length)
  }
  return { planned, done, total }
}

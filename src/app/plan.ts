import { addDays, isoDate, weekKey } from '../core/history'
import { REST, nextPlannedDay, rotationState, routinesForDay, workoutsOn } from '../core/schedule'
import type { ISODate, Ms, Profile, Routine } from '../core/types'
import { deleteItem } from './profile'

export const newId = (): string => crypto.randomUUID()

/** Weekday numbers (0 = Sunday) in display order. */
export const orderedWeekdays = (weekStart: 0 | 1) => Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7)

/** Date -> routine id for the loop's coming sessions, from today on. */
export function rotationCalendar(p: Profile, today: ISODate, days = 28): Map<ISODate, string> {
  const out = new Map<ISODate, string>()
  const rot = p.rotation
  if (!rot) return out
  const st = rotationState(rot, p.workouts)
  if (st.next < 0) return out
  const firstDue = st.lastDate ? addDays(st.lastDate, 1 + st.restsBefore) : today
  let d = firstDue > today ? firstDue : today
  const end = addDays(today, days)
  let i = st.next
  while (d <= end) {
    const id = rot.sequence[i]
    if (id !== REST) out.set(d, id)
    i = (i + 1) % rot.sequence.length
    d = addDays(d, 1)
  }
  return out
}

/** Like routinesForDay, but the loop also shows its future days and a finished today is not planned again. */
export function plannedOn(p: Profile, iso: ISODate, today: ISODate): string[] {
  if (p.dayPlan[iso] || p.scheduleMode !== 'rotation' || !p.rotation) return routinesForDay(p, iso, today)
  if (iso < today) return []
  const id = rotationCalendar(p, today).get(iso)
  return id ? [id] : []
}

export function nextTraining(p: Profile, today: ISODate): { date: ISODate; routineIds: string[] } | null {
  if (p.scheduleMode !== 'rotation') return nextPlannedDay(p, today)
  for (let i = 1; i <= 28; i++) {
    const date = addDays(today, i)
    const routineIds = plannedOn(p, date, today)
    if (routineIds.length) return { date, routineIds }
  }
  return null
}

export type TodayStatus = 'train' | 'done' | 'rest'

export function todayState(p: Profile, today: ISODate): { status: TodayStatus; ids: string[] } {
  const ids = plannedOn(p, today, today)
  const done = workoutsOn(p.workouts, today).length
  if (done > 0 && done >= ids.length) return { status: 'done', ids }
  return { status: ids.length ? 'train' : 'rest', ids }
}

export type DayStatus = 'done' | 'planned' | 'missed' | 'rest'

export interface StripDay {
  date: ISODate
  ids: string[]
  status: DayStatus
  isToday: boolean
}

export function weekStrip(p: Profile, now = new Date()): StripDay[] {
  const today = isoDate(now)
  const start = weekKey(now, p.settings.weekStart)
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i)
    const ids = plannedOn(p, date, today)
    const status: DayStatus = workoutsOn(p.workouts, date).length ? 'done' : !ids.length ? 'rest' : date < today ? 'missed' : 'planned'
    return { date, ids, status, isToday: date === today }
  })
}

export function setDayOverride(p: Profile, iso: ISODate, value: string | null): Profile {
  const dayPlan = { ...p.dayPlan }
  if (value) dayPlan[iso] = value
  else delete dayPlan[iso]
  return { ...p, dayPlan }
}

/** Move one session to another date without touching the plan; a session already there swaps back. */
export function moveSession(p: Profile, from: ISODate, routineId: string, to: ISODate, today: ISODate): Profile {
  if (from === to) return p
  const left = plannedOn(p, from, today).filter(id => id !== routineId)
  const there = plannedOn(p, to, today)
  return { ...p, dayPlan: { ...p.dayPlan, [from]: left[0] ?? there[0] ?? REST, [to]: routineId } }
}

export function setWeekDay(p: Profile, weekday: number, ids: string[]): Profile {
  return { ...p, week: { ...p.week, [weekday]: ids } }
}

/** The fixed week as a loop: its routines in order, with its rest days between them. */
export function rotationFromWeek(p: Profile): string[] {
  const seq = orderedWeekdays(p.settings.weekStart).map(d => (p.week[d]?.length ? p.week[d][0] : REST))
  return seq.some(x => x !== REST) ? seq : p.routines.map(r => r.id)
}

export function setScheduleMode(p: Profile, mode: Profile['scheduleMode'], now: Ms = Date.now()): Profile {
  if (mode === p.scheduleMode) return p
  if (mode === 'rotation' && !p.rotation) {
    return { ...p, scheduleMode: mode, rotation: { id: newId(), sequence: rotationFromWeek(p), since: now } }
  }
  return { ...p, scheduleMode: mode }
}

export function setRotationSequence(p: Profile, sequence: string[], now: Ms = Date.now()): Profile {
  return { ...p, rotation: p.rotation ? { ...p.rotation, sequence } : { id: newId(), sequence, since: now } }
}

export const restartRotation = (p: Profile, now: Ms = Date.now()): Profile =>
  p.rotation ? { ...p, rotation: { ...p.rotation, since: now } } : p

export function copyRoutine(p: Profile, id: string, suffix: string, now: Ms = Date.now(), makeId = newId): Profile {
  const r = p.routines.find(x => x.id === id)
  if (!r) return p
  const copy: Routine = { ...structuredClone(r), id: makeId(), name: `${r.name} (${suffix})`, updatedAt: now }
  const i = p.routines.indexOf(r)
  return { ...p, routines: [...p.routines.slice(0, i + 1), copy, ...p.routines.slice(i + 1)] }
}

/** Delete a routine everywhere it is scheduled. */
export function removeRoutine(p: Profile, id: string, now: Ms = Date.now()): Profile {
  const next = deleteItem(p, 'routines', id, now)
  const week = Object.fromEntries(Object.entries(p.week).map(([d, ids]) => [d, ids.filter(x => x !== id)]))
  const dayPlan = Object.fromEntries(Object.entries(p.dayPlan).filter(([, v]) => v !== id))
  const rotation = p.rotation && { ...p.rotation, sequence: p.rotation.sequence.filter(x => x !== id) }
  return { ...next, week, dayPlan, rotation }
}

export type PlanSnapshot = Pick<Profile, 'routines' | 'week' | 'dayPlan' | 'rotation' | 'scheduleMode' | 'planId' | 'deleted'>

export const planSnapshot = ({ routines, week, dayPlan, rotation, scheduleMode, planId, deleted }: Profile): PlanSnapshot =>
  ({ routines, week, dayPlan, rotation, scheduleMode, planId, deleted })

export interface IncomingSchedule {
  week?: Record<number, string[]>
  sequence?: string[]
}

/**
 * Bring a schedule into a profile that may already have one: an unscheduled profile
 * takes it whole, a week only fills its free days, and a running loop is left alone.
 */
export function mergeSchedule(p: Profile, inc: IncomingSchedule, now: Ms): Profile {
  const hasWeek = Object.values(p.week).some(ids => ids.length)
  const hasLoop = !!p.rotation?.sequence.some(x => x !== REST)
  if (!hasWeek && !hasLoop) {
    if (inc.sequence?.length) return { ...p, scheduleMode: 'rotation', rotation: { id: newId(), sequence: inc.sequence, since: now } }
    if (inc.week) return { ...p, scheduleMode: 'week', week: inc.week }
    return p
  }
  if (p.scheduleMode === 'week' && inc.week) {
    const week = { ...p.week }
    for (const [d, ids] of Object.entries(inc.week)) if (!week[Number(d)]?.length) week[Number(d)] = ids
    return { ...p, week }
  }
  return p
}

export function addWeighIn(p: Profile, w: number, date: ISODate, now: Ms = Date.now()): Profile {
  return { ...p, bodyweight: [...p.bodyweight.filter(b => b.date !== date), { date, w, t: now }] }
}

export function weightTrend(p: Profile): { last: number; date: ISODate; delta: number | null } | null {
  const sorted = [...p.bodyweight].sort((a, b) => a.date.localeCompare(b.date) || a.t - b.t)
  const last = sorted.at(-1)
  if (!last) return null
  const prev = sorted.at(-2)
  return { last: last.w, date: last.date, delta: prev ? Math.round((last.w - prev.w) * 10) / 10 : null }
}

/** June to August. */
export const isHeatSeason = (d = new Date()) => d.getMonth() >= 5 && d.getMonth() <= 7

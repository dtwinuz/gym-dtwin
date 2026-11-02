import { exerciseById } from '../catalogue'
import { REST } from '../core/schedule'
import type { Ms, Policy, Profile, Routine, Slot, Unit } from '../core/types'
import { convert, roundLift } from '../core/units'
import { mergeSchedule, newId, orderedWeekdays, type IncomingSchedule } from './plan'
import { normalizeSupersets, sanitizeSlot } from './slots'

export const PLAN_KIND = 'gym-dtwin-plan'
const MAX_ROUTINES = 50
const MAX_SLOTS = 80
const POLICIES: Policy[] = ['off', 'linear', 'greyskull', 'double', 'triple', 'time']

export interface PlanFile {
  kind: typeof PLAN_KIND
  v: 1
  unit: Unit
  routines: Omit<Routine, 'updatedAt'>[]
  week?: Record<number, string[]>
  rotation?: string[]
}

export function buildPlanFile(p: Profile): PlanFile {
  const known = new Set(p.routines.map(r => r.id))
  const file: PlanFile = {
    kind: PLAN_KIND,
    v: 1,
    unit: p.settings.unit,
    routines: p.routines.map(({ id, name, glyph, prog, ex }) => ({ id, name, glyph, prog, ex })),
  }
  if (p.scheduleMode === 'rotation' && p.rotation) {
    file.rotation = p.rotation.sequence.filter(x => x === REST || known.has(x))
  } else {
    const week: Record<number, string[]> = {}
    for (const [d, ids] of Object.entries(p.week)) {
      const list = ids.filter(x => known.has(x))
      if (list.length) week[Number(d)] = list
    }
    file.week = week
  }
  return file
}

export type ParsedPlan = { ok: true; file: PlanFile; dropped: string[] } | { ok: false }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Read an untrusted plan file: anything the app cannot use is left out. */
export function parsePlanFile(text: string): ParsedPlan {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false }
  }
  if (!isObj(raw) || raw.kind !== PLAN_KIND || raw.v !== 1 || !Array.isArray(raw.routines)) return { ok: false }
  const dropped: string[] = []
  const routines: PlanFile['routines'] = []
  for (const r of raw.routines.slice(0, MAX_ROUTINES)) {
    if (!isObj(r) || typeof r.id !== 'string' || !Array.isArray(r.ex)) continue
    const ex: Slot[] = []
    for (const s of r.ex.slice(0, MAX_SLOTS)) {
      if (!isObj(s) || typeof s.exId !== 'string') continue
      if (!exerciseById(s.exId)) {
        dropped.push(s.exId)
        continue
      }
      const subs = Array.isArray(s.subs) ? s.subs.filter((id): id is string => typeof id === 'string') : []
      for (const id of subs) if (!exerciseById(id)) dropped.push(id)
      const pyramid = Array.isArray(s.pyramid) ? (s.pyramid as Slot['pyramid']) : undefined
      ex.push(sanitizeSlot({ ...(s as unknown as Slot), pyramid, subs: subs.filter(id => exerciseById(id)), note: typeof s.note === 'string' ? s.note : undefined }))
    }
    routines.push({
      id: r.id,
      name: (typeof r.name === 'string' ? r.name : '').slice(0, 80) || '?',
      glyph: typeof r.glyph === 'string' ? r.glyph.slice(0, 3) : undefined,
      prog: POLICIES.includes(r.prog as Policy) ? (r.prog as Policy) : undefined,
      ex: normalizeSupersets(ex),
    })
  }
  const ids = new Set(routines.map(r => r.id))
  const file: PlanFile = { kind: PLAN_KIND, v: 1, unit: raw.unit === 'lb' ? 'lb' : 'kg', routines }
  if (Array.isArray(raw.rotation)) {
    file.rotation = raw.rotation.filter((x): x is string => x === REST || (typeof x === 'string' && ids.has(x)))
  } else if (isObj(raw.week)) {
    const week: Record<number, string[]> = {}
    for (let d = 0; d < 7; d++) {
      const list = raw.week[String(d)]
      if (Array.isArray(list)) week[d] = list.filter((x): x is string => typeof x === 'string' && ids.has(x))
    }
    file.week = week
  }
  return { ok: true, file, dropped: [...new Set(dropped)] }
}

/** Add the file's routines under new ids; the schedule merges, nothing of the user's is overwritten. */
export function mergePlanFile(p: Profile, file: PlanFile, now: Ms = Date.now(), makeId = newId): Profile {
  const to = p.settings.unit
  const ids = new Map<string, string>()
  const w = (v: number) => (file.unit === to ? v : roundLift(convert(v, file.unit, to), to))
  const routines: Routine[] = file.routines.map(r => {
    const id = makeId()
    ids.set(r.id, id)
    return { ...r, id, updatedAt: now, ex: r.ex.map(s => ({ ...s, weight: w(s.weight), ...(s.inc == null ? {} : { inc: w(s.inc) }) })) }
  })
  const remap = (x: string) => (x === REST ? REST : ids.get(x) ?? '')
  const inc: IncomingSchedule = file.rotation
    ? { sequence: file.rotation.map(remap).filter(Boolean) }
    : { week: Object.fromEntries(Object.entries(file.week ?? {}).map(([d, list]) => [Number(d), list.map(remap).filter(Boolean)])) }
  return { ...mergeSchedule(p, inc, now), routines: [...p.routines, ...routines] }
}

export function planSummary(p: Profile, dayName: (weekday: number) => string, restLabel: string): string {
  const name = (id: string) => p.routines.find(r => r.id === id)?.name
  const lines: string[] = []
  if (p.scheduleMode === 'rotation' && p.rotation) {
    lines.push(p.rotation.sequence.map(x => (x === REST ? restLabel : name(x))).filter(Boolean).join(' > '))
  } else {
    for (const d of orderedWeekdays(p.settings.weekStart)) {
      const names = (p.week[d] ?? []).map(name).filter(Boolean)
      if (names.length) lines.push(`${dayName(d)}: ${names.join(', ')}`)
    }
  }
  return lines.join('\n').slice(0, 1200)
}

export const telegramShareUrl = (url: string, text: string) =>
  `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`

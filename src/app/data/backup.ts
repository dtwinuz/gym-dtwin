import { FORMULAS } from '../../core/onerm'
import type { ISODate, Ms, Profile, Settings } from '../../core/types'
import { normalizeProfile } from '../profile'

export const BACKUP_KIND = 'gym-dtwin-backup'
export const PRE_RESTORE_KEY = 'gym-dtwin:v2:pre-restore'

export interface BackupFile {
  kind: typeof BACKUP_KIND
  v: 1
  exportedAt: string
  profile: Profile
}

export const buildBackup = (profile: Profile, now: Ms = Date.now()): BackupFile => ({
  kind: BACKUP_KIND, v: 1, exportedAt: new Date(now).toISOString(), profile,
})

export interface BackupSummary {
  workouts: number
  routines: number
  weighIns: number
  from?: ISODate
  to?: ISODate
}

export function backupSummary(p: Profile): BackupSummary {
  const dates = p.workouts.map(w => w.date).sort()
  const out: BackupSummary = { workouts: p.workouts.length, routines: p.routines.length, weighIns: p.bodyweight.length }
  if (dates.length) {
    out.from = dates[0]
    out.to = dates.at(-1)
  }
  return out
}

export type BackupError = 'json' | 'kind' | 'version' | 'shape'
export type ParsedBackup = { ok: true; profile: Profile; exportedAt?: string } | { ok: false; error: BackupError }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const optNum = (v: unknown) => v == null || isNum(v)
const isStr = (v: unknown) => typeof v === 'string'
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const strings = (v: unknown) => Array.isArray(v) && v.every(isStr)
const listOf = (v: unknown, ok: (x: Record<string, unknown>) => boolean) => Array.isArray(v) && v.every(x => isObj(x) && ok(x))
const optList = (v: unknown, ok: (x: Record<string, unknown>) => boolean) => v == null || listOf(v, ok)
const optObj = (v: unknown) => v == null || isObj(v)

const okSet = (s: Record<string, unknown>) => ['w', 'r', 'sec', 'min', 'speed', 'incline', 'km', 'rir', 'rpe'].every(k => optNum(s[k]))
const okEntry = (e: Record<string, unknown>) => isStr(e.exId) && listOf(e.sets, okSet)
const okSlot = (s: Record<string, unknown>) => isStr(s.exId) && isNum(s.sets) && isNum(s.reps) && isNum(s.weight)
const okRoutine = (r: Record<string, unknown>) => isStr(r.id) && isStr(r.name) && listOf(r.ex, okSlot)
const okWorkout = (w: Record<string, unknown>) =>
  isStr(w.id) && isStr(w.name) && isDate(w.date) && isNum(w.start) && isNum(w.end) && isNum(w.vol) &&
  listOf(w.entries, okEntry) && strings(w.routineIds) && strings(w.prs)
const okWeighIn = (b: Record<string, unknown>) => isDate(b.date) && isNum(b.w)
const okMeasure = (m: Record<string, unknown>) => isDate(m.date) && isObj(m.values)
const okCustom = (c: Record<string, unknown>) => isStr(c.id) && isStr(c.name) && strings(c.primary) && strings(c.secondary)
const okActive = (a: unknown) => a == null || (isObj(a) && listOf(a.entries, okEntry) && isNum(a.start))

function okProfile(p: Record<string, unknown>): boolean {
  return (
    isObj(p.settings) && listOf(p.workouts, okWorkout) && listOf(p.routines, okRoutine) && optList(p.bodyweight, okWeighIn) &&
    optList(p.measurements, okMeasure) && optList(p.customEx, okCustom) && okActive(p.active) &&
    [p.week, p.dayPlan, p.dayNotes, p.exWeights, p.exNotes, p.barWeights, p.plates, p.deleted, p.rotation].every(optObj) &&
    (p.favEx == null || strings(p.favEx)) && (p.gear == null || strings(p.gear))
  )
}

const CHOICES: { [K in keyof Settings]?: readonly Settings[K][] } = {
  lang: ['uz', 'ru', 'en'],
  unit: ['kg', 'lb'],
  wdec: [1, 2],
  theme: ['dark', 'light', 'system'],
  body: ['male', 'female'],
  effort: ['none', 'rir', 'rpe'],
  logRef: ['last', 'best'],
  startFrom: ['plan', 'last'],
  workoutView: ['cards', 'list'],
  weekStart: [0, 1],
  weightGoal: ['lose', 'gain', 'hold'],
}

/** Keep what fits; a setting the app could not use goes back to its default. */
function cleanSettings(p: Profile, raw: Record<string, unknown>): Settings {
  const base = normalizeProfile({ settings: raw.lang === 'uz' || raw.lang === 'ru' || raw.lang === 'en' ? { lang: raw.lang } as Settings : undefined }).settings
  const out: Record<string, unknown> = { ...p.settings }
  for (const [key, was] of Object.entries(base)) {
    const v = out[key]
    const allowed = (CHOICES as Record<string, readonly unknown[] | undefined>)[key]
    if (allowed ? !allowed.includes(v) : was != null && typeof v !== typeof was) out[key] = was
  }
  if (!(String(out.oneRmFormula) in FORMULAS)) out.oneRmFormula = base.oneRmFormula
  if (!/^#[0-9a-f]{6}$/i.test(String(out.accent))) out.accent = base.accent
  return out as unknown as Settings
}

/** A profile from outside the app (file or server), or null when its shape is not usable. */
export function readProfile(raw: unknown): Profile | null {
  if (!isObj(raw) || !okProfile(raw)) return null
  const present = Object.entries(raw).filter(([, v]) => v != null)
  const profile = normalizeProfile(Object.fromEntries(present) as Partial<Profile>)
  profile.settings = cleanSettings(profile, raw.settings as Record<string, unknown>)
  return profile
}

/** Read an untrusted backup. Failure changes nothing and says why. */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown
  try {
    raw = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
  } catch {
    return { ok: false, error: 'json' }
  }
  if (!isObj(raw) || raw.kind !== BACKUP_KIND) return { ok: false, error: 'kind' }
  if (raw.v !== 1) return { ok: false, error: 'version' }
  const profile = readProfile(raw.profile)
  if (!profile) return { ok: false, error: 'shape' }
  return typeof raw.exportedAt === 'string' ? { ok: true, profile, exportedAt: raw.exportedAt } : { ok: true, profile }
}

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** A copy of the profile as it was; false when the device has no room for it. */
export function stashPreRestore(kv: KV | null, p: Profile): boolean {
  if (!kv) return false
  try {
    kv.removeItem(PRE_RESTORE_KEY)
    kv.setItem(PRE_RESTORE_KEY, JSON.stringify(p))
    return true
  } catch {
    return false
  }
}

export function readPreRestore(kv: KV | null): Profile | null {
  try {
    const raw = kv?.getItem(PRE_RESTORE_KEY)
    return raw ? normalizeProfile(JSON.parse(raw) as Partial<Profile>) : null
  } catch {
    return null
  }
}

export function clearPreRestore(kv: KV | null) {
  try {
    kv?.removeItem(PRE_RESTORE_KEY)
  } catch {
    // nothing to clear in blocked storage
  }
}

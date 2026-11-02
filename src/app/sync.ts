import type { Ms, Profile } from '../core/types'
import { convertProfileUnits } from './convert'
import { emptyProfile } from './profile'

/*
 * Merge rule, per field path (`settings.theme`, `dayPlan.2026-11-02`, `favEx.Plank`, ...):
 * the later `stamps[path]` wins, written by stampChanges on every local change. Equal times
 * fall to the larger canonical JSON so both orders agree. A field with no stamp was last
 * changed before sync existed, so any stamp beats it. Between two unstamped fields a value
 * beats a default and then the more recently used profile wins. So old profiles need no
 * migration and a fresh device never beats real data.
 */

const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype'])
const DEFAULTS = emptyProfile(0, 'uz')

const SCALARS = ['scheduleMode', 'rotation', 'targetW', 'gear', 'planId', 'onboardedAt'] as const
const DICTS = ['week', 'dayPlan', 'dayNotes', 'exWeights', 'exNotes', 'barWeights', 'plates'] as const
const OBJECTS = ['settings', 'notify'] as const

interface ListSpec { list: 'routines' | 'workouts' | 'customEx' | 'bodyweight' | 'measurements'; id: string; at: string }
const LISTS: ListSpec[] = [
  { list: 'routines', id: 'id', at: 'updatedAt' },
  { list: 'workouts', id: 'id', at: 'updatedAt' },
  { list: 'customEx', id: 'id', at: 'updatedAt' },
  { list: 'bodyweight', id: 'date', at: 't' },
  { list: 'measurements', id: 'date', at: 't' },
]

type Row = Record<string, unknown>
type Bag = Record<string, unknown>

/** JSON with sorted keys and undefined left out, so equal content gives equal text. */
export function canon(v: unknown): string {
  if (v === undefined) return ''
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? ''
  if (Array.isArray(v)) return `[${v.map(x => canon(x) || 'null').join(',')}]`
  const o = v as Bag
  const parts = Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => `${JSON.stringify(k)}:${canon(o[k])}`)
  return `{${parts.join(',')}}`
}

/** Same data, whatever the profile clock says. */
export const sameDoc = (a: Profile, b: Profile) => canon({ ...a, updatedAt: 0 }) === canon({ ...b, updatedAt: 0 })

/** How strong a field's claim is: [stamped 2, plain value 1, default 0], then its time. */
function claim(p: Profile, path: string, value: unknown, def: unknown): [number, Ms] {
  const stamp = p.stamps?.[path]
  if (stamp != null) return [2, stamp]
  return canon(value) === canon(def) ? [0, 0] : [1, p.updatedAt]
}

const prefixed = (p: Profile, prefix: string) =>
  Object.keys(p.stamps ?? {}).filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length))

const safeKeys = (...lists: string[][]) => [...new Set(lists.flat())].filter(k => !FORBIDDEN.has(k))

/** The stronger claim wins. Keeps the latest real stamp; an unstamped winner stays unstamped. */
function pick<T>(a: Profile, b: Profile, path: string, va: T, vb: T, def: unknown, stamps: Record<string, Ms>): T {
  const [ra, ta] = claim(a, path, va, def)
  const [rb, tb] = claim(b, path, vb, def)
  if (ra === 2 || rb === 2) stamps[path] = Math.max(ra === 2 ? ta : 0, rb === 2 ? tb : 0)
  if (ra !== rb) return ra > rb ? va : vb
  if (ta !== tb) return ta > tb ? va : vb
  return canon(va) >= canon(vb) ? va : vb
}

function mergeBag(a: Profile, b: Profile, key: string, va: Bag, vb: Bag, defs: Bag, stamps: Record<string, Ms>): Bag {
  const out: Bag = {}
  const prefix = `${key}.`
  for (const k of safeKeys(Object.keys(va), Object.keys(vb), prefixed(a, prefix), prefixed(b, prefix))) {
    const v = pick(a, b, prefix + k, va[k], vb[k], defs[k], stamps)
    if (v !== undefined) out[k] = v
  }
  return out
}

/** The newer profile's order, then what only the other side has. */
function ordered(primary: Row[], secondary: Row[], id: string, kept: Map<string, Row>): Row[] {
  const seen = new Set<string>()
  const out: Row[] = []
  for (const row of [...primary, ...secondary]) {
    const key = String(row[id])
    const item = kept.get(key)
    if (item && !seen.has(key)) {
      seen.add(key)
      out.push(item)
    }
  }
  return out
}

function mergeList(spec: ListSpec, a: Profile, b: Profile, newer: Profile, older: Profile, tombs: Record<string, Ms>): Row[] {
  const best = new Map<string, Row>()
  for (const row of [...(a[spec.list] as unknown as Row[]), ...(b[spec.list] as unknown as Row[])]) {
    const key = String(row[spec.id])
    if (FORBIDDEN.has(key)) continue
    const have = best.get(key)
    if (!have) {
      best.set(key, row)
      continue
    }
    const ta = Number(have[spec.at] ?? 0)
    const tb = Number(row[spec.at] ?? 0)
    if (tb > ta || (tb === ta && canon(row) > canon(have))) best.set(key, row)
  }
  for (const [key, row] of best) {
    const tomb = tombs[key]
    if (tomb == null) continue
    if (tomb >= Number(row[spec.at] ?? 0)) best.delete(key)
    else delete tombs[key]
  }
  return ordered(newer[spec.list] as unknown as Row[], older[spec.list] as unknown as Row[], spec.id, best)
}

function mergeTombs(a: Profile, b: Profile): Record<string, Record<string, Ms>> {
  const out: Record<string, Record<string, Ms>> = {}
  for (const list of safeKeys(Object.keys(a.deleted), Object.keys(b.deleted))) {
    const row: Record<string, Ms> = {}
    for (const side of [a.deleted[list] ?? {}, b.deleted[list] ?? {}]) {
      for (const id of safeKeys(Object.keys(side))) row[id] = Math.max(row[id] ?? 0, side[id])
    }
    out[list] = row
  }
  return out
}

function activeTime(p: Profile): Ms {
  const stamp = p.stamps?.active ?? 0
  return p.active ? Math.max(stamp, p.active.lastAt ?? 0, p.active.start) : stamp
}

/** The newer session stands; one that was finished or deleted since then does not come back. */
function mergeActive(a: Profile, b: Profile, merged: Pick<Profile, 'workouts' | 'deleted'>, stamps: Record<string, Ms>) {
  const ta = activeTime(a)
  const tb = activeTime(b)
  const at = Math.max(ta, tb)
  if (at > 0) stamps.active = at
  const active = ta !== tb ? (ta > tb ? a.active : b.active) : canon(a.active) >= canon(b.active) ? a.active : b.active
  if (!active || active.editingId) return active
  const done = merged.workouts.some(w => w.id === active.id && w.updatedAt >= at)
  const gone = (merged.deleted.workouts?.[active.id] ?? 0) >= at
  return done || gone ? null : active
}

/** Weights only make sense in their profile's unit, so the losing side is converted first. */
function sameUnit(a: Profile, b: Profile): [Profile, Profile] {
  if (a.settings.unit === b.settings.unit) return [a, b]
  const unit = pick(a, b, 'settings.unit', a.settings.unit, b.settings.unit, DEFAULTS.settings.unit, {})
  return a.settings.unit === unit ? [a, convertProfileUnits(b, unit)] : [convertProfileUnits(a, unit), b]
}

/**
 * Merge two profiles of one person; the argument order does not change the result.
 * Lists go by id with the later time winning. A tombstone beats an item that is not newer
 * than it and an item newer than the tombstone lifts it. Objects and dictionaries go by key.
 */
export function mergeProfiles(local: Profile, server: Profile): Profile {
  const [a, b] = sameUnit(local, server)
  const newerFirst = a.updatedAt !== b.updatedAt ? a.updatedAt > b.updatedAt : canon(a) >= canon(b)
  const newer = newerFirst ? a : b
  const older = newerFirst ? b : a
  const stamps: Record<string, Ms> = {}

  const out: Profile = { ...older, ...newer, updatedAt: Math.max(a.updatedAt, b.updatedAt) }
  const tombs = mergeTombs(a, b)
  const bag = out as unknown as Bag

  for (const spec of LISTS) {
    const row = tombs[spec.list] ?? {}
    bag[spec.list] = mergeList(spec, a, b, newer, older, row)
    if (Object.keys(row).length) tombs[spec.list] = row
    else delete tombs[spec.list]
  }
  out.deleted = tombs

  for (const key of OBJECTS) {
    const defs = key === 'settings' ? (DEFAULTS.settings as unknown as Bag) : {}
    const merged = mergeBag(a, b, key, (a[key] ?? {}) as unknown as Bag, (b[key] ?? {}) as unknown as Bag, defs, stamps)
    if (key === 'settings' || Object.keys(merged).length) bag[key] = merged
    else delete bag[key]
  }

  for (const key of DICTS) {
    bag[key] = mergeBag(a, b, key, a[key] as unknown as Bag, b[key] as unknown as Bag, {}, stamps)
  }

  for (const key of SCALARS) {
    const v = pick(a, b, key, a[key], b[key], DEFAULTS[key], stamps)
    if (v === undefined) delete bag[key]
    else bag[key] = v
  }

  const favIn = (p: Profile) => Object.fromEntries(p.favEx.map(x => [x, true])) as Bag
  const fav = mergeBag(a, b, 'favEx', favIn(a), favIn(b), {}, stamps)
  out.favEx = [...new Set([...newer.favEx, ...older.favEx])].filter(x => fav[x])

  out.active = mergeActive(a, b, out, stamps)
  out.stamps = stamps
  return out
}

function stampBag(prev: Bag, next: Bag, prefix: string, mark: (path: string) => void) {
  if (prev === next) return
  for (const k of new Set([...Object.keys(prev), ...Object.keys(next)])) {
    if (prev[k] !== next[k] && canon(prev[k]) !== canon(next[k])) mark(prefix + k)
  }
}

function stampList(spec: ListSpec, prev: Profile, next: Profile, converted: boolean, now: Ms, deleted: Profile['deleted']): Row[] | null {
  const before = prev[spec.list] as unknown as Row[]
  const after = next[spec.list] as unknown as Row[]
  if (before === after) return null
  const old = new Map(before.map(r => [String(r[spec.id]), r]))
  const rows = after.map(row => {
    const was = old.get(String(row[spec.id]))
    if (was === row) return row
    if (!was) return Number(row[spec.at] ?? 0) >= now ? row : { ...row, [spec.at]: now }
    if (converted || was[spec.at] !== row[spec.at] || canon(was) === canon(row)) return row
    return { ...row, [spec.at]: now }
  })
  const present = new Set(after.map(r => String(r[spec.id])))
  for (const id of old.keys()) {
    if (present.has(id) || next.deleted[spec.list]?.[id] != null) continue
    deleted[spec.list] = { ...deleted[spec.list], [id]: now }
  }
  return rows
}

/**
 * What a local change means for sync: stamp each changed field, give removed items a
 * tombstone and re-added or silently edited items a new time. This catches every writer
 * (undo, restore, import) without touching them. A unit change rewrites each weight but
 * is not an edit of those items, so their times stay.
 */
export function stampChanges(prev: Profile, next: Profile, now: Ms): Profile {
  const stamps: Record<string, Ms> = { ...prev.stamps, ...next.stamps }
  const mark = (path: string) => { stamps[path] = now }

  for (const key of OBJECTS) stampBag((prev[key] ?? {}) as unknown as Bag, (next[key] ?? {}) as unknown as Bag, `${key}.`, mark)
  for (const key of DICTS) stampBag(prev[key] as unknown as Bag, next[key] as unknown as Bag, `${key}.`, mark)
  for (const key of SCALARS) if (prev[key] !== next[key] && canon(prev[key]) !== canon(next[key])) mark(key)
  if (prev.favEx !== next.favEx) {
    const had = new Set(prev.favEx)
    const has = new Set(next.favEx)
    for (const x of new Set([...had, ...has])) if (had.has(x) !== has.has(x)) mark(`favEx.${x}`)
  }
  if (prev.active !== next.active) mark('active')

  const converted = prev.settings.unit !== next.settings.unit
  const deleted = { ...next.deleted }
  const out: Profile = { ...next, stamps, deleted }
  const bag = out as unknown as Bag
  for (const spec of LISTS) {
    const rows = stampList(spec, prev, next, converted, now, deleted)
    if (rows) bag[spec.list] = rows
  }
  return out
}

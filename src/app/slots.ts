import { allowedPolicies, modeOf } from '../core/progression'
import type { Mode, Slot } from '../core/types'

export const MAX_SUBS = 5

const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
const int = (v: unknown, min: number, max: number, fallback: number) => Math.round(num(v, min, max, fallback))

export function parsePyramid(text: string): (number | 'max')[] {
  const out: (number | 'max')[] = []
  for (const part of text.split(/[\s,;]+/)) {
    if (!part) continue
    if (part.toLowerCase() === 'max') out.push('max')
    else if (/^\d+$/.test(part) && Number(part) >= 1 && Number(part) <= 100) out.push(Number(part))
  }
  return out.slice(0, 20)
}

export const formatPyramid = (p: Slot['pyramid']) => (p ?? []).join(', ')

/** One valid slot for its mode: numbers in range, no fields the mode cannot use. */
export function sanitizeSlot(raw: Slot): Slot {
  const mode: Mode = modeOf(raw)
  const out: Slot = { exId: raw.exId, sets: int(raw.sets, 1, 20, 3), reps: 0, weight: num(raw.weight, 0, 2000, 0) }
  if (mode !== 'reps') out.mode = mode

  if (mode === 'reps') {
    out.reps = int(raw.reps, 1, 100, 10)
    if (raw.repsMin != null && Number(raw.repsMin) > 0) {
      const low = int(raw.repsMin, 1, 100, 1)
      if (low < out.reps) out.repsMin = low
    }
    if (raw.warmups != null && Number(raw.warmups) > 0) out.warmups = int(raw.warmups, 0, 6, 0)
    if (raw.intensifier === 'dropset' || raw.intensifier === 'restpause') out.intensifier = raw.intensifier
    if (out.intensifier === 'dropset') {
      out.dropCount = int(raw.dropCount, 1, 5, 2)
      out.dropPct = int(raw.dropPct, 5, 50, 20)
    }
    const pyramid = (raw.pyramid ?? []).filter(x => x === 'max' || (Number.isInteger(x) && x >= 1 && x <= 100)).slice(0, 20)
    if (pyramid.length) {
      out.pyramid = pyramid
      out.sets = pyramid.length
    }
  } else if (mode === 'time') {
    out.sec = int(raw.sec, 1, 3600, 30)
  } else {
    out.min = int(raw.min, 1, 600, 10)
    if (raw.speed != null && Number(raw.speed) > 0) out.speed = num(raw.speed, 0, 100, 0)
    if (raw.incline != null && Number(raw.incline) > 0) out.incline = num(raw.incline, 0, 100, 0)
  }

  if (raw.prog && allowedPolicies(mode).includes(raw.prog)) out.prog = raw.prog
  if (out.prog === 'triple' && raw.setsMax != null && Number(raw.setsMax) > 0) out.setsMax = int(raw.setsMax, out.sets, 10, out.sets)
  if (raw.inc != null && Number(raw.inc) > 0) out.inc = num(raw.inc, 0, 100, 0)
  if (raw.deloadFactor != null && Number(raw.deloadFactor) > 0) out.deloadFactor = num(raw.deloadFactor, 0.5, 0.99, 0.9)
  if (raw.assisted) out.assisted = true
  else if (raw.bodyweight) out.bodyweight = true
  if (raw.side) out.side = true
  if (raw.restOff) out.restOff = true
  else if (raw.restSec != null && String(raw.restSec) !== '') out.restSec = int(raw.restSec, 0, 900, 90)
  if (raw.sg) out.sg = String(raw.sg).slice(0, 12)
  const subs = [...new Set(raw.subs ?? [])].filter(id => id && id !== raw.exId).slice(0, MAX_SUBS)
  if (subs.length) out.subs = subs
  const note = (raw.note ?? '').trim().slice(0, 500)
  if (note) out.note = note
  return out
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = [...list]
  const [x] = next.splice(from, 1)
  next.splice(to, 0, x)
  return next
}

const LETTERS = [...'abcdefghijklmnopqrstuvwxyz']

/** A superset is a contiguous run: split runs get their own id, a lone member loses it. */
export function normalizeSupersets(ex: Slot[]): Slot[] {
  const used = new Set<string>()
  const fresh = () => LETTERS.find(c => !used.has(c) && !ex.some(s => s.sg === c)) ?? `s${used.size}`
  const out: Slot[] = []
  for (let i = 0; i < ex.length; ) {
    const sg = ex[i].sg
    let j = i + 1
    while (sg && j < ex.length && ex[j].sg === sg) j++
    const id = sg && used.has(sg) ? fresh() : sg
    if (id) used.add(id)
    for (let k = i; k < j; k++) {
      const s = { ...ex[k] }
      if (j - i > 1 && id) s.sg = id
      else delete s.sg
      out.push(s)
    }
    i = j
  }
  return out
}

/** Link a slot with the next one, or split them when they are already linked. */
export function toggleSuperset(ex: Slot[], i: number): Slot[] {
  const a = ex[i]
  const b = ex[i + 1]
  if (!a || !b) return ex
  if (a.sg && a.sg === b.sg) {
    const tail = `split-${i}`
    return normalizeSupersets(ex.map((s, n) => (n > i && s.sg === a.sg ? { ...s, sg: tail } : s)))
  }
  const taken = new Set(ex.map(s => s.sg).filter(Boolean))
  const id = a.sg ?? b.sg ?? LETTERS.find(c => !taken.has(c)) ?? `s${i}`
  const oldB = b.sg
  return normalizeSupersets(ex.map((s, n) => (n === i || n === i + 1 || (oldB && s.sg === oldB) ? { ...s, sg: id } : s)))
}

/** A sensible first slot for an exercise picked from the catalogue. */
export function newSlot(exId: string, category?: string): Slot {
  if (category === 'cardio') return { exId, mode: 'cardio', sets: 1, reps: 0, min: 10, weight: 0, prog: 'off', restOff: true }
  if (category === 'stretching') return { exId, mode: 'time', sets: 2, reps: 0, sec: 30, weight: 0, prog: 'off' }
  return { exId, sets: 3, reps: 10, repsMin: 8, weight: 0 }
}

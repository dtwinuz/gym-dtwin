import { convert } from '../core/units'
import type { Entry, Profile, Slot, Unit } from '../core/types'

const r2 = (v: number) => Math.round(v * 100) / 100

/** Re-express every stored weight of the profile in another unit. */
export function convertProfileUnits(p: Profile, to: Unit): Profile {
  const from = p.settings.unit
  if (from === to) return p
  const c = (w: number) => r2(convert(w, from, to))
  const cw = (w: number | undefined) => (w == null ? w : c(w))
  const slot = (s: Slot): Slot => ({ ...s, weight: c(s.weight), inc: cw(s.inc) })
  const entry = (e: Entry): Entry => ({
    ...e,
    sets: e.sets.map(s => ({
      ...s,
      w: cw(s.w),
      drops: s.drops?.map(d => ({ ...d, w: c(d.w) })),
      sides: s.sides && { L: { ...s.sides.L, w: cw(s.sides.L.w) }, R: { ...s.sides.R, w: cw(s.sides.R.w) } },
    })),
    target: e.target && slot(e.target),
    rx: e.rx && { ...e.rx, weight: c(e.rx.weight) },
  })
  const mapVals = <T,>(o: Record<string, T>, f: (v: T) => T) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]))
  return {
    ...p,
    settings: { ...p.settings, unit: to },
    routines: p.routines.map(r => ({ ...r, ex: r.ex.map(slot) })),
    workouts: p.workouts.map(w => ({ ...w, bw: cw(w.bw), vol: c(w.vol), entries: w.entries.map(entry) })),
    active: p.active && { ...p.active, entries: p.active.entries.map(entry) },
    bodyweight: p.bodyweight.map(b => ({ ...b, w: c(b.w) })),
    targetW: p.targetW == null ? null : c(p.targetW),
    exWeights: mapVals(p.exWeights, v => ({ ...v, w: c(v.w) })),
    barWeights: mapVals(p.barWeights, c),
  }
}

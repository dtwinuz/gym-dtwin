import { describe, expect, it } from 'vitest'
import type { ActiveSession, Measurement, Profile, Routine, WeighIn, Workout } from '../core/types'
import { convertProfileUnits } from './convert'
import { deleteItem, emptyProfile, upsertItem } from './profile'
import { canon, mergeProfiles, sameDoc, stampChanges } from './sync'

const base = (over: Partial<Profile> = {}): Profile => ({ ...emptyProfile(1, 'uz'), ...over })

const workout = (id: string, updatedAt: number, over: Partial<Workout> = {}): Workout => ({
  id, date: '2026-11-01', start: 1000, end: 2000, routineIds: [], name: id, entries: [], prs: [], vol: 0, updatedAt, ...over,
})
const routine = (id: string, updatedAt: number, name = id): Routine => ({ id, name, ex: [], updatedAt })
const weigh = (date: string, w: number, t: number): WeighIn => ({ date, w, t })
const measure = (date: string, t: number): Measurement => ({ date, t, values: { waist: t } })
const session = (id: string, start: number, lastAt?: number): ActiveSession => ({
  id, date: '2026-11-01', start, lastAt, routineIds: [], name: id, entries: [], cur: 0,
})
const ids = (rows: { id: string }[]) => rows.map(r => r.id).sort()

/** The same edit a device makes through the store. */
const edit = (p: Profile, fn: (x: Profile) => Profile, at: number): Profile => ({ ...stampChanges(p, fn(p), at), updatedAt: at })

describe('mergeProfiles: lists', () => {
  it('keeps items only one side has', () => {
    const m = mergeProfiles(base({ workouts: [workout('a', 5)] }), base({ workouts: [workout('b', 6)] }))
    expect(ids(m.workouts)).toEqual(['a', 'b'])
  })

  it('the later updatedAt wins for the same id', () => {
    const m = mergeProfiles(base({ routines: [routine('r', 5, 'old')] }), base({ routines: [routine('r', 9, 'new')] }))
    expect(m.routines).toEqual([routine('r', 9, 'new')])
  })

  it('a tombstone newer than the item removes it', () => {
    const m = mergeProfiles(base({ workouts: [workout('a', 5)] }), base({ deleted: { workouts: { a: 6 } } }))
    expect(m.workouts).toEqual([])
    expect(m.deleted.workouts).toEqual({ a: 6 })
  })

  it('an item newer than the tombstone comes back and lifts it', () => {
    const m = mergeProfiles(base({ workouts: [workout('a', 9)] }), base({ deleted: { workouts: { a: 6 } } }))
    expect(ids(m.workouts)).toEqual(['a'])
    expect(m.deleted.workouts).toBeUndefined()
  })

  it('a delete at the same moment as the edit wins', () => {
    const m = mergeProfiles(base({ workouts: [workout('a', 6)] }), base({ deleted: { workouts: { a: 6 } } }))
    expect(m.workouts).toEqual([])
  })

  it('the later of two tombstones stands', () => {
    const m = mergeProfiles(base({ deleted: { routines: { r: 3 } } }), base({ deleted: { routines: { r: 8 } }, routines: [routine('r', 5)] }))
    expect(m.routines).toEqual([])
    expect(m.deleted.routines).toEqual({ r: 8 })
  })

  it('keeps tombstones of lists it does not know', () => {
    const m = mergeProfiles(base({ deleted: { later: { x: 3 } } }), base())
    expect(m.deleted.later).toEqual({ x: 3 })
  })

  it('merges weigh-ins and measurements by date using their own time', () => {
    const m = mergeProfiles(
      base({ bodyweight: [weigh('2026-11-01', 80, 5), weigh('2026-11-02', 81, 5)], measurements: [measure('2026-11-01', 9)] }),
      base({ bodyweight: [weigh('2026-11-01', 79, 7)], measurements: [measure('2026-11-01', 4)], deleted: { bodyweight: { '2026-11-02': 6 } } }),
    )
    expect(m.bodyweight).toEqual([weigh('2026-11-01', 79, 7)])
    expect(m.measurements).toEqual([measure('2026-11-01', 9)])
  })

  it('treats a custom exercise without a time as the oldest version', () => {
    const plain = { id: 'c', name: 'plain', bodyPart: '', equipment: '', primary: [], secondary: [], category: '' }
    const m = mergeProfiles(base({ customEx: [plain] }), base({ customEx: [{ ...plain, name: 'timed', updatedAt: 1 }] }))
    expect(m.customEx[0].name).toBe('timed')
  })

  it('takes the order of the newer profile and adds the other side after it', () => {
    const newer = base({ updatedAt: 9, routines: [routine('b', 1), routine('a', 1)] })
    const older = base({ updatedAt: 2, routines: [routine('a', 1), routine('c', 1), routine('b', 1)] })
    expect(mergeProfiles(newer, older).routines.map(r => r.id)).toEqual(['b', 'a', 'c'])
    expect(mergeProfiles(older, newer).routines.map(r => r.id)).toEqual(['b', 'a', 'c'])
  })
})

describe('mergeProfiles: settings and fields', () => {
  it('merges settings field by field by stamp', () => {
    const start = base()
    const a = edit(start, p => ({ ...p, settings: { ...p.settings, theme: 'dark' } }), 100)
    const b = edit(start, p => ({ ...p, settings: { ...p.settings, restSec: 120 } }), 200)
    const m = mergeProfiles(a, b)
    expect(m.settings.theme).toBe('dark')
    expect(m.settings.restSec).toBe(120)
    expect(m.updatedAt).toBe(200)
  })

  it('the later stamp wins the same setting, even on the older profile', () => {
    const start = base()
    const a = { ...edit(start, p => ({ ...p, settings: { ...p.settings, theme: 'dark' } }), 300), updatedAt: 300 }
    const b = edit(edit(start, p => ({ ...p, settings: { ...p.settings, theme: 'light' } }), 200), p => ({ ...p, targetW: 70 }), 500)
    expect(mergeProfiles(a, b).settings.theme).toBe('dark')
    expect(mergeProfiles(a, b).targetW).toBe(70)
  })

  it('old profile without stamps: its non-default values beat a fresh device', () => {
    const old = base({ updatedAt: 50, settings: { ...base().settings, theme: 'dark', restSec: 200 }, targetW: 75, scheduleMode: 'rotation' })
    const fresh = base({ updatedAt: 9000 })
    const m = mergeProfiles(fresh, old)
    expect(m.settings.theme).toBe('dark')
    expect(m.settings.restSec).toBe(200)
    expect(m.targetW).toBe(75)
    expect(m.scheduleMode).toBe('rotation')
    expect(m.updatedAt).toBe(9000)
  })

  it('two old profiles: the more recently used one wins a conflict', () => {
    const a = base({ updatedAt: 50, settings: { ...base().settings, theme: 'dark' } })
    const b = base({ updatedAt: 60, settings: { ...base().settings, theme: 'light' } })
    expect(mergeProfiles(a, b).settings.theme).toBe('light')
  })

  it('a stamped return to the default beats an older non-default', () => {
    const a = base({ updatedAt: 50, settings: { ...base().settings, theme: 'dark' } })
    const b = edit(a, p => ({ ...p, settings: { ...p.settings, theme: 'system' } }), 80)
    expect(mergeProfiles(a, b).settings.theme).toBe('system')
  })

  it('merges dictionaries per key', () => {
    const start = base({ dayPlan: { '2026-11-01': 'r1' } })
    const a = edit(start, p => ({ ...p, dayPlan: { ...p.dayPlan, '2026-11-02': 'r2' }, exNotes: { bench: 'x' } }), 100)
    const b = edit(start, p => ({ ...p, dayPlan: { ...p.dayPlan, '2026-11-03': 'rest' }, exWeights: { bench: { w: 50, date: '2026-11-01' } } }), 200)
    const m = mergeProfiles(a, b)
    expect(m.dayPlan).toEqual({ '2026-11-01': 'r1', '2026-11-02': 'r2', '2026-11-03': 'rest' })
    expect(m.exNotes).toEqual({ bench: 'x' })
    expect(m.exWeights.bench.w).toBe(50)
  })

  it('a key removed later stays removed; added later comes back', () => {
    const start = base({ updatedAt: 10, dayPlan: { d1: 'r' }, barWeights: { bench: 20 } })
    const removed = edit(start, p => ({ ...p, dayPlan: {} }), 100)
    expect(mergeProfiles(start, removed).dayPlan).toEqual({})
    const again = edit(start, p => ({ ...p, dayPlan: { d1: 'q' } }), 200)
    expect(mergeProfiles(removed, again).dayPlan).toEqual({ d1: 'q' })
  })

  it('favourites merge per exercise', () => {
    const start = base({ updatedAt: 10, favEx: ['a', 'b'] })
    const left = edit(start, p => ({ ...p, favEx: ['b', 'c'] }), 100)
    const right = edit(start, p => ({ ...p, favEx: ['a', 'b', 'd'] }), 200)
    expect(mergeProfiles(left, right).favEx.sort()).toEqual(['b', 'c', 'd'])
  })

  it('notify prefs merge per field and may be absent', () => {
    const start = base()
    const on = { enabled: true, time: '18:00', days: [1], quietFrom: '22:00', quietTo: '08:00', tz: 'Asia/Tashkent', diary: false }
    const a = edit(start, p => ({ ...p, notify: on }), 100)
    const b = edit(a, p => ({ ...p, notify: { ...on, time: '19:00' } }), 200)
    expect(mergeProfiles(a, b).notify?.time).toBe('19:00')
    expect(mergeProfiles(start, a).notify).toEqual(on)
    expect('notify' in mergeProfiles(start, start)).toBe(false)
  })

  it('ignores prototype keys from outside', () => {
    const evil = JSON.parse('{"__proto__":{"polluted":1},"ok":"r"}') as Record<string, string>
    const m = mergeProfiles(base({ updatedAt: 5, dayPlan: evil }), base())
    expect(m.dayPlan).toEqual({ ok: 'r' })
    expect(({} as { polluted?: number }).polluted).toBeUndefined()
    expect((m.dayPlan as { polluted?: number }).polluted).toBeUndefined()
  })

  it('keeps fields it does not know from the newer profile', () => {
    const newer = { ...base({ updatedAt: 9 }), future: 1 } as Profile
    expect((mergeProfiles(newer, base()) as unknown as { future: number }).future).toBe(1)
  })
})

describe('mergeProfiles: active session', () => {
  it('the device with the newer session keeps it', () => {
    const a = base({ active: session('s1', 100, 900) })
    const b = base({ active: session('s2', 500, 600) })
    expect(mergeProfiles(a, b).active?.id).toBe('s1')
    expect(mergeProfiles(b, a).active?.id).toBe('s1')
  })

  it('a session survives a device that never had one', () => {
    expect(mergeProfiles(base({ active: session('s', 100) }), base()).active?.id).toBe('s')
  })

  it('finishing elsewhere ends the session here', () => {
    const running = base({ active: session('s', 100, 200), updatedAt: 200 })
    const finished = edit(running, p => ({ ...upsertItem(p, 'workouts', workout('s', 300), 300), active: null }), 300)
    const m = mergeProfiles(running, finished)
    expect(m.active).toBeNull()
    expect(ids(m.workouts)).toEqual(['s'])
  })

  it('a finished session does not come back without any stamps', () => {
    const m = mergeProfiles(base({ active: session('s', 100, 200) }), base({ workouts: [workout('s', 300)] }))
    expect(m.active).toBeNull()
  })

  it('a session deleted after its last change does not come back', () => {
    const m = mergeProfiles(base({ active: session('s', 100, 200) }), base({ deleted: { workouts: { s: 300 } } }))
    expect(m.active).toBeNull()
  })

  it('a set logged after finishing elsewhere keeps the session open', () => {
    const m = mergeProfiles(base({ active: session('s', 100, 400) }), base({ workouts: [workout('s', 300)] }))
    expect(m.active?.id).toBe('s')
  })

  it('editing a saved workout is not ended by that workout existing', () => {
    const editing = { ...session('e', 100, 200), editingId: 'w' }
    const m = mergeProfiles(base({ active: editing }), base({ workouts: [workout('w', 300)] }))
    expect(m.active?.editingId).toBe('w')
  })
})

describe('mergeProfiles: units', () => {
  it('converts the side that lost the unit, keeping each item\'s time', () => {
    const entries = [{ exId: 'bench', sets: [{ w: 100, r: 5, done: true }] }]
    const start = base({ updatedAt: 10, workouts: [workout('old', 5, { entries, vol: 500 })] })
    const lb = edit(start, p => convertProfileUnits(p, 'lb'), 100)
    const logged = edit(start, p => upsertItem(p, 'workouts', workout('new', 200, { entries, vol: 500 }), 200), 200)
    const m = mergeProfiles(lb, logged)
    expect(m.settings.unit).toBe('lb')
    const weight = (id: string) => m.workouts.find(w => w.id === id)!.entries[0].sets[0].w
    expect(weight('new')).toBeCloseTo(220.46, 1)
    expect(weight('old')).toBeCloseTo(220.46, 1)
    expect(m.workouts.find(w => w.id === 'old')!.updatedAt).toBe(5)
    expect(canon(mergeProfiles(logged, lb))).toBe(canon(m))
  })

  it('an edit made in the old unit beats the conversion of the older version', () => {
    const set = (w: number) => [{ exId: 'bench', sets: [{ w, r: 5, done: true }] }]
    const start = base({ updatedAt: 10, workouts: [workout('a', 5, { entries: set(100) })] })
    const lb = edit(start, p => convertProfileUnits(p, 'lb'), 100)
    const fixed = edit(start, p => upsertItem(p, 'workouts', workout('a', 90, { entries: set(110) }), 90), 90)
    const m = mergeProfiles(lb, fixed)
    expect(m.workouts[0].entries[0].sets[0].w).toBeCloseTo(242.51, 1)
  })
})

function makeRng(seed: number) {
  let s = seed
  return (n: number) => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return Math.floor((s / 4294967296) * n)
  }
}

function randomProfile(seed: number): Profile {
  const r = makeRng(seed)
  const id = () => `id${r(8)}`
  const t = () => 1 + r(50)
  r(7)
  const p = base({ updatedAt: t() })
  for (let i = r(6); i > 0; i--) p.workouts = [...p.workouts.filter(w => w.id !== 'x'), workout(id(), t())]
  p.workouts = [...new Map(p.workouts.map(w => [w.id, w])).values()]
  for (let i = r(4); i > 0; i--) p.routines = [...new Map([...p.routines, routine(id(), t())].map(x => [x.id, x])).values()]
  for (let i = r(4); i > 0; i--) p.deleted = { ...p.deleted, workouts: { ...p.deleted.workouts, [id()]: t() } }
  for (let i = r(3); i > 0; i--) p.deleted = { ...p.deleted, routines: { ...p.deleted.routines, [id()]: t() } }
  for (let i = r(3); i > 0; i--) p.dayPlan = { ...p.dayPlan, [`d${r(5)}`]: id() }
  for (let i = r(3); i > 0; i--) p.favEx = [...new Set([...p.favEx, id()])]
  const stamps: Record<string, number> = {}
  if (r(2)) stamps['settings.theme'] = t()
  if (r(2)) stamps[`dayPlan.d${r(5)}`] = t()
  if (r(2)) stamps[`favEx.id${r(8)}`] = t()
  if (r(2)) stamps.active = t()
  if (Object.keys(stamps).length) p.stamps = stamps
  if (r(2)) p.settings = { ...p.settings, theme: r(2) ? 'dark' : 'light', restSec: 30 + r(5) }
  if (r(3) === 0) p.active = session(id(), t(), r(2) ? t() : undefined)
  if (r(3) === 0) p.targetW = 50 + r(40)
  return p
}

describe('mergeProfiles: properties over many random pairs', () => {
  const pairs = Array.from({ length: 300 }, (_, i) => [randomProfile(i * 2 + 1), randomProfile(i * 2 + 2)] as const)

  it('is commutative', () => {
    for (const [a, b] of pairs) expect(canon(mergeProfiles(a, b))).toBe(canon(mergeProfiles(b, a)))
  })

  // Only list order may differ, and only when two different profiles have the exact same clock.
  const content = (p: Profile) => canon({
    ...p,
    favEx: [...p.favEx].sort(),
    workouts: [...p.workouts].sort((x, y) => x.id.localeCompare(y.id)),
    routines: [...p.routines].sort((x, y) => x.id.localeCompare(y.id)),
  })

  it('is idempotent: merging the result again changes nothing', () => {
    for (const [a, b] of pairs) {
      const m = mergeProfiles(a, b)
      expect(canon(mergeProfiles(m, m))).toBe(canon(m))
      const again = a.updatedAt === b.updatedAt ? content : canon
      expect(again(mergeProfiles(m, a))).toBe(again(m))
      expect(again(mergeProfiles(m, b))).toBe(again(m))
    }
  })

  it('two devices converge whatever order they sync in', () => {
    for (let i = 0; i < 100; i++) {
      const [a, b, c] = [randomProfile(i * 3 + 1000), randomProfile(i * 3 + 1001), randomProfile(i * 3 + 1002)]
      const first = mergeProfiles(mergeProfiles(a, b), c)
      const second = mergeProfiles(mergeProfiles(c, a), b)
      expect(ids(first.workouts)).toEqual(ids(second.workouts))
      expect(ids(first.routines)).toEqual(ids(second.routines))
      expect(first.deleted).toEqual(second.deleted)
    }
  })

  it('loses nothing: every item is present unless a tombstone at least as new covers it', () => {
    for (const [a, b] of pairs) {
      const m = mergeProfiles(a, b)
      for (const w of [...a.workouts, ...b.workouts]) {
        const kept = m.workouts.find(x => x.id === w.id)
        if (kept) expect(kept.updatedAt).toBeGreaterThanOrEqual(w.updatedAt)
        else expect(m.deleted.workouts?.[w.id]).toBeGreaterThanOrEqual(w.updatedAt)
      }
    }
  })
})

describe('stampChanges', () => {
  it('stamps only what changed', () => {
    const p = base({ updatedAt: 5, dayPlan: { a: 'r' } })
    const s = stampChanges(p, { ...p, settings: { ...p.settings, theme: 'dark' }, dayPlan: { a: 'r', b: 'q' } }, 100).stamps
    expect(s).toEqual({ 'settings.theme': 100, 'dayPlan.b': 100 })
  })

  it('no real change, no stamp', () => {
    const p = base({ dayPlan: { a: 'r' } })
    expect(stampChanges(p, { ...p, dayPlan: { a: 'r' }, settings: { ...p.settings } }, 100).stamps).toEqual({})
  })

  it('keeps earlier stamps', () => {
    const p = base({ stamps: { 'settings.theme': 7 } })
    expect(stampChanges(p, { ...p, targetW: 70 }, 100).stamps).toEqual({ 'settings.theme': 7, targetW: 100 })
  })

  it('stamps the session on every change, including the end', () => {
    const p = base({ active: session('s', 1) })
    expect(stampChanges(p, { ...p, active: null }, 100).stamps?.active).toBe(100)
  })

  it('a removal with no tombstone gets one (undo of an import, restore)', () => {
    const p = base({ workouts: [workout('a', 5), workout('b', 5)] })
    const next = stampChanges(p, { ...p, workouts: [workout('b', 5)] }, 100)
    expect(next.deleted.workouts).toEqual({ a: 100 })
    const merged = mergeProfiles(next, p)
    expect(ids(merged.workouts)).toEqual(['b'])
  })

  it('leaves the tombstone a proper delete already wrote', () => {
    const p = base({ workouts: [workout('a', 5)] })
    expect(stampChanges(p, deleteItem(p, 'workouts', 'a', 50), 100).deleted.workouts).toEqual({ a: 50 })
  })

  it('an item put back gets a new time, so the undo survives the server tombstone', () => {
    const before = base({ workouts: [workout('a', 5)], updatedAt: 5 })
    const gone = edit(before, p => deleteItem(p, 'workouts', 'a', 50), 50)
    const undone = stampChanges(gone, { ...before }, 100)
    expect(undone.workouts[0].updatedAt).toBe(100)
    expect(ids(mergeProfiles(undone, gone).workouts)).toEqual(['a'])
  })

  it('a silent edit of an item gets a new time, an unchanged copy does not', () => {
    const p = base({ routines: [routine('r', 5, 'old'), routine('s', 5)] })
    const next = stampChanges(p, { ...p, routines: [routine('r', 5, 'new'), routine('s', 5)] }, 100)
    expect(next.routines.map(r => r.updatedAt)).toEqual([100, 5])
  })

  it('a unit change does not touch item times', () => {
    const p = base({ routines: [routine('r', 5)], bodyweight: [weigh('2026-11-01', 80, 5)] })
    const next = stampChanges(p, convertProfileUnits(p, 'lb'), 100)
    expect(next.routines[0].updatedAt).toBe(5)
    expect(next.bodyweight[0].t).toBe(5)
    expect(next.stamps?.['settings.unit']).toBe(100)
  })

  it('sameDoc ignores the profile clock only', () => {
    const p = base()
    expect(sameDoc(p, { ...p, updatedAt: 99 })).toBe(true)
    expect(sameDoc(p, { ...p, targetW: 1 })).toBe(false)
  })
})

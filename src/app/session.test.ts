import { describe, expect, it } from 'vitest'
import { nextPrescription } from '../core/progression'
import type { ActiveSession, Entry, Profile, Routine, Settings, Slot, Workout } from '../core/types'
import { emptyProfile } from './profile'
import {
  addDrop, addExercise, addSet, addToRoutine, addedEntries, barWeightOf, buildEntry, canTick, draftWorkout, finishSession, nextPending, nextTime, pairExercises, parseEntry, parseNum,
  patchSide, plateLine, previousOfRoutine, refEntry, removeExercise, removeSet, restAfter, restExpired, restLeft, restPause, restResume, restShift, restStart, sameEntry, sessionVolume,
  settleWork, splitSuperset, startSession, startWork, swapExercise, tickNext, tickSet,
} from './session'

const NOW = new Date(2026, 10, 2, 18, 0, 0).getTime()
const BENCH = 'Barbell_Bench_Press_-_Medium_Grip'
const CURL = 'Dumbbell_Bicep_Curl'
const SQUAT = 'Barbell_Squat'

const slot = (over: Partial<Slot> = {}): Slot => ({ exId: BENCH, sets: 3, reps: 5, weight: 60, ...over })
const routine = (ex: Slot[], id = 'r1'): Routine => ({ id, name: 'Push', ex, updatedAt: 0 })

const profile = (ex: Slot[] = [slot()], over: Partial<Profile> = {}, settings: Partial<Settings> = {}): Profile => {
  const p = emptyProfile(0, 'en')
  return { ...p, routines: [routine(ex)], ...over, settings: { ...p.settings, ...settings } }
}

const logged = (exId: string, w: number, reps: number[], start: number, over: Partial<Entry> = {}, target: Slot = slot({ exId })): Workout => ({
  id: `w${start}`, date: '2026-10-20', start, end: start + 1000, routineIds: ['r1'], name: 'Push', prs: [], vol: 0, updatedAt: start,
  entries: [{ exId, target, rx: { sets: target.sets, reps: target.reps, weight: w }, sets: reps.map(r => ({ w, r, done: true })), ...over }],
})

const tickAll = (s: ActiveSession, settings: Settings, now = NOW) => {
  let out = s
  while (nextPending(out)) out = tickNext(out, settings, now)
  return out
}

describe('parsing', () => {
  it('takes a comma as a decimal point', () => {
    expect(parseNum('62,5')).toBe(62.5)
    expect(parseNum('62.5')).toBe(62.5)
    expect(parseNum('')).toBeUndefined()
    expect(parseNum('abc')).toBeUndefined()
    expect(parseNum('7,6', true)).toBe(8)
  })

  it('keeps the workout route entry contract', () => {
    const p = profile()
    const today = '2026-11-02'
    expect(parseEntry(new URLSearchParams('routine=r1'), p, today)).toEqual({ ids: ['r1'], date: today })
    expect(parseEntry(new URLSearchParams('routine=r1&date=2026-10-20'), p, today)).toEqual({ ids: ['r1'], date: '2026-10-20' })
    expect(parseEntry(new URLSearchParams('routine=r1&date=2027-01-01'), p, today).date).toBe(today)
    expect(parseEntry(new URLSearchParams('routine=r1&date=bad'), p, today).date).toBe(today)
    expect(parseEntry(new URLSearchParams('routine=gone'), p, today).ids).toEqual([])
    expect(sameEntry(startSession(p, ['r1'], today, '', NOW), ['r1'], today)).toBe(true)
    expect(sameEntry(startSession(p, ['r1'], today, '', NOW), ['r1'], '2026-10-20')).toBe(false)
  })
})

describe('start', () => {
  it('prefills from the prescription and records why', () => {
    const p = profile([slot()], { workouts: [logged(BENCH, 60, [5, 5, 5], NOW - 86400000)] })
    const s = startSession(p, ['r1'], '2026-11-02', '', NOW)
    const e = s.entries[0]
    expect(e.sets).toHaveLength(3)
    expect(e.sets[0]).toMatchObject({ w: 62.5, r: 5, done: false })
    expect(e.rx).toMatchObject({ weight: 62.5, reps: 5, why: 'load' })
    expect(e.routineId).toBe('r1')
    expect(e.target?.exId).toBe(BENCH)
  })

  it('startFrom last copies the last session, best the best one', () => {
    const workouts = [logged(BENCH, 80, [3, 3, 3], NOW - 2e8), logged(BENCH, 60, [5, 5, 4], NOW - 1e8)]
    const last = buildEntry(profile([slot()], { workouts }, { startFrom: 'last', logRef: 'last' }), slot(), undefined, NOW)
    expect(last.sets.map(x => [x.w, x.r])).toEqual([[60, 5], [60, 5], [60, 4]])
    const best = buildEntry(profile([slot()], { workouts }, { startFrom: 'last', logRef: 'best' }), slot(), undefined, NOW)
    expect(best.sets.map(x => [x.w, x.r])).toEqual([[80, 3], [80, 3], [80, 3]])
    expect(refEntry([], 'last', 'epley')).toBeUndefined()
  })

  it('builds warm-ups, pyramid, drops and rest-pause rows', () => {
    const p = profile()
    const warm = buildEntry(p, slot({ warmups: 2 }), undefined, NOW)
    expect(warm.sets.filter(x => x.warmup).map(x => x.w)).toEqual([30, 45])
    expect(warm.sets.filter(x => !x.warmup)).toHaveLength(3)
    const py = buildEntry(p, slot({ pyramid: [12, 10, 'max'], sets: 3, weight: 40 }), undefined, NOW)
    expect(py.sets.map(x => x.r)).toEqual([12, 10, undefined])
    expect(canTick(py.sets[2], 'reps')).toBe(false)
    const drop = buildEntry(p, slot({ intensifier: 'dropset', dropCount: 2, dropPct: 20 }), undefined, NOW)
    expect(drop.sets[2].drops).toEqual([{ w: 48, r: 5 }, { w: 38.5, r: 5 }])
    const rp = buildEntry(p, slot({ intensifier: 'restpause' }), undefined, NOW)
    expect(rp.sets.at(-1)).toMatchObject({ rp: true, w: 60, r: 3 })
  })

  it('builds time and cardio rows', () => {
    const p = profile()
    expect(buildEntry(p, slot({ mode: 'time', sec: 45, weight: 0, reps: 0 }), undefined, NOW).sets[0]).toMatchObject({ sec: 45 })
    const c = buildEntry(p, slot({ mode: 'cardio', min: 20, speed: 8, incline: 2, sets: 3, reps: 0, weight: 0 }), undefined, NOW)
    expect(c.sets).toHaveLength(1)
    expect(c.sets[0]).toMatchObject({ min: 20, speed: 8, incline: 2 })
  })

  it('a past day prescribes from what was before that day', () => {
    const later = logged(BENCH, 100, [5, 5, 5], new Date(2026, 9, 25).getTime())
    const s = startSession(profile([slot()], { workouts: [later] }), ['r1'], '2026-10-20', '', NOW)
    expect(s.entries[0].rx?.why).toBe('first')
    expect(s.entries[0].sets[0].w).toBe(60)
  })
})

describe('ticking', () => {
  const p = profile([slot()])
  const s0 = startSession(p, ['r1'], '2026-11-02', '', NOW)

  it('starts the rest with the right length', () => {
    const s = tickSet(s0, 0, 0, p.settings, NOW)
    expect(s.entries[0].sets[0].done).toBe(true)
    expect(s.rest).toEqual({ endsAt: NOW + 90000, total: 90 })
    const own = startSession(profile([slot({ restSec: 120 })]), ['r1'], '2026-11-02', '', NOW)
    expect(tickSet(own, 0, 0, p.settings, NOW).rest?.total).toBe(120)
    const off = startSession(profile([slot({ restOff: true })]), ['r1'], '2026-11-02', '', NOW)
    expect(tickSet(off, 0, 0, p.settings, NOW).rest).toBeUndefined()
  })

  it('warm-ups and rest-pause take their own rest', () => {
    const warm = startSession(profile([slot({ warmups: 1 })]), ['r1'], '2026-11-02', '', NOW)
    expect(restAfter(warm, 0, 0, p.settings)).toBe(60)
    expect(restAfter(warm, 0, 0, { ...p.settings, warmupRestSec: 40 })).toBe(40)
    const rp = startSession(profile([slot({ sets: 1, intensifier: 'restpause' })]), ['r1'], '2026-11-02', '', NOW)
    expect(restAfter(rp, 0, 0, p.settings)).toBe(p.settings.restPauseSec)
  })

  it('unticking does not start a rest', () => {
    const s = tickSet(tickSet(s0, 0, 0, p.settings, NOW), 0, 0, p.settings, NOW + 1000)
    expect(s.entries[0].sets[0].done).toBe(false)
    expect(s.rest?.endsAt).toBe(NOW + 90000)
  })

  it('a past day runs no rest timer', () => {
    const past = startSession(p, ['r1'], '2026-10-20', '', NOW)
    expect(tickSet(past, 0, 0, p.settings, NOW).rest).toBeUndefined()
  })

  it('alternates inside a superset and rests after its last member', () => {
    const sp = profile([slot({ sg: 'a', sets: 2 }), slot({ exId: CURL, sg: 'a', sets: 2 }), slot({ exId: SQUAT, sets: 1 })])
    let s = startSession(sp, ['r1'], '2026-11-02', '', NOW)
    s = tickNext(s, sp.settings, NOW)
    expect(s.cur).toBe(1)
    expect(s.rest).toBeUndefined()
    s = tickNext(s, sp.settings, NOW)
    expect(s.cur).toBe(0)
    expect(s.rest?.total).toBe(90)
    s = tickNext(s, sp.settings, NOW)
    s = tickNext(s, sp.settings, NOW)
    expect(s.cur).toBe(2)
  })

  it('per-side sets aggregate and finish on both', () => {
    const sp = profile([slot({ side: true, reps: 10, sets: 1 })])
    let s = startSession(sp, ['r1'], '2026-11-02', '', NOW)
    expect(s.entries[0].sets[0].sides?.L.r).toBe(5)
    s = patchSide(s, 0, 0, 'R', { r: 4, w: 62.5 })
    expect(s.entries[0].sets[0]).toMatchObject({ w: 62.5, r: 9 })
    s = tickNext(s, sp.settings, NOW)
    expect(s.entries[0].sets[0].done).toBe(false)
    expect(s.rest).toBeUndefined()
    expect(nextPending(s)).toMatchObject({ side: 'R' })
    s = tickNext(s, sp.settings, NOW)
    expect(s.entries[0].sets[0].done).toBe(true)
    expect(s.rest).toBeDefined()
  })

  it('a timed set completes itself when its countdown ends', () => {
    const sp = profile([slot({ mode: 'time', sec: 30, reps: 0, weight: 0, sets: 1 })])
    let s = startWork(startSession(sp, ['r1'], '2026-11-02', '', NOW), 0, 0, NOW)
    expect(s.work?.endsAt).toBe(NOW + 30000)
    expect(settleWork(s, sp.settings, NOW + 29000)).toBe(s)
    s = settleWork(s, sp.settings, NOW + 30000)
    expect(s.entries[0].sets[0].done).toBe(true)
    expect(s.work).toBeUndefined()
    expect(s.rest).toBeDefined()
  })
})

describe('rest timer', () => {
  it('survives a reload: the end time is absolute', () => {
    const p = profile()
    const s = tickSet(startSession(p, ['r1'], '2026-11-02', '', NOW), 0, 0, p.settings, NOW)
    const restored = normalizeRoundTrip({ ...p, active: s }).active!
    expect(restLeft(restored.rest!, NOW + 30000)).toBe(60)
    expect(restExpired(restored.rest!, NOW + 89999)).toBe(false)
    expect(restExpired(restored.rest!, NOW + 90000)).toBe(true)
  })

  it('pauses, resumes and shifts', () => {
    const r = restStart(90, NOW)
    const paused = restPause(r, NOW + 10000)
    expect(restLeft(paused, NOW + 500000)).toBe(80)
    expect(restExpired(paused, NOW + 500000)).toBe(false)
    const back = restResume(paused, NOW + 500000)
    expect(back.endsAt).toBe(NOW + 580000)
    expect(restLeft(restShift(r, 15, NOW)!, NOW)).toBe(105)
    expect(restLeft(restShift(r, -15, NOW)!, NOW)).toBe(75)
    expect(restShift(r, -15, NOW + 80000)).toBeUndefined()
    expect(restLeft(restShift(paused, 15, NOW + 500000)!, NOW + 900000)).toBe(95)
  })
})

const normalizeRoundTrip = (p: Profile): Profile => JSON.parse(JSON.stringify(p))

describe('editing a session', () => {
  const p = profile([slot(), slot({ exId: CURL, subs: [SQUAT] })])
  const s0 = startSession(p, ['r1'], '2026-11-02', '', NOW)

  it('adds and removes sets without their flags', () => {
    const marked = { ...s0, entries: s0.entries.map((e, i) => (i === 0 ? { ...e, sets: e.sets.map(x => ({ ...x, failure: true, done: true })) } : e)) }
    const s = addSet(marked, 0)
    expect(s.entries[0].sets).toHaveLength(4)
    expect(s.entries[0].sets[3]).toEqual(expect.objectContaining({ w: 60, r: 5, done: false }))
    expect(s.entries[0].sets[3].failure).toBeUndefined()
    expect(removeSet(s, 0, 3).entries[0].sets).toHaveLength(3)
  })

  it('adds drops', () => {
    const s = addDrop(addDrop(s0, 0, 0, 'kg'), 0, 0, 'kg')
    expect(s.entries[0].sets[0].drops).toEqual([{ w: 48, r: 5 }, { w: 38.5, r: 5 }])
  })

  it('swap replaces an untouched exercise and keeps the routine', () => {
    const s = swapExercise(p, s0, 1, SQUAT)
    expect(s.entries).toHaveLength(2)
    expect(s.entries[1].exId).toBe(SQUAT)
    expect(s.entries[1].routineId).toBe('r1')
    expect(s.entries[1].target?.subs).toContain(CURL)
  })

  it('swap keeps done sets with the old exercise', () => {
    const s = swapExercise(p, tickSet(s0, 1, 0, p.settings, NOW), 1, SQUAT)
    expect(s.entries.map(e => e.exId)).toEqual([BENCH, CURL, SQUAT])
    expect(s.entries[1].sets).toHaveLength(1)
    expect(s.entries[2].sets.every(x => !x.done)).toBe(true)
    expect(s.cur).toBe(2)
  })

  it('adds and removes exercises and keeps the cursor valid', () => {
    const added = addExercise(p, s0, SQUAT)
    expect(added.entries[2].exId).toBe(SQUAT)
    expect(added.entries[2].routineId).toBeUndefined()
    expect(added.cur).toBe(2)
    expect(removeExercise(added, 2).cur).toBe(1)
    expect(removeExercise(removeExercise(s0, 0), 0).entries).toEqual([])
  })

  it('pairs and splits a superset on the fly', () => {
    const three = addExercise(p, s0, SQUAT)
    const paired = pairExercises(three, 0, 2)
    expect(paired.entries.map(e => e.exId)).toEqual([BENCH, SQUAT, CURL])
    expect(paired.entries[0].sg).toBeTruthy()
    expect(paired.entries[0].sg).toBe(paired.entries[1].sg)
    expect(paired.entries[2].sg).toBeUndefined()
    const split = splitSuperset(paired, 1)
    expect(split.entries.every(e => !e.sg)).toBe(true)
  })
})

describe('plates', () => {
  it('finds the bar and solves a compact line', () => {
    const p = profile()
    expect(barWeightOf(p, BENCH)).toBe(20)
    expect(barWeightOf(p, CURL)).toBe(0)
    expect(barWeightOf({ ...p, barWeights: { [BENCH]: 15 } }, BENCH)).toBe(15)
    expect(plateLine(p, BENCH, 62.5)?.perSide).toEqual([20, 1.25])
    expect(plateLine(p, CURL, 20)).toBeNull()
    expect(plateLine(p, BENCH, 10)).toBeNull()
    expect(plateLine({ ...p, plates: { kg: { 20: 1 } } }, BENCH, 100)?.short).toBe(40)
  })
})

describe('finish', () => {
  const prior = logged(BENCH, 60, [5, 5, 5], NOW - 86400000)
  const p = profile([slot({ warmups: 1 })], { workouts: [prior] })

  it('computes volume and load PR without warm-ups, and only keeps done sets', () => {
    let s = startSession(p, ['r1'], '2026-11-02', '', NOW)
    s = tickSet(s, 0, 0, p.settings, NOW)
    s = tickSet(s, 0, 1, p.settings, NOW)
    s = tickSet(s, 0, 2, p.settings, NOW)
    const w = draftWorkout(p, s, { now: NOW + 3600000 })
    expect(w.entries[0].sets).toHaveLength(3)
    expect(w.vol).toBe(62.5 * 5 * 2)
    expect(w.prs).toEqual([BENCH])
    expect(w.e1prs).toEqual([])
    expect(w.end).toBe(NOW + 3600000)
    expect(w.entries[0].rx).toMatchObject({ weight: 62.5, why: 'load' })
    expect(w.entries[0].target?.exId).toBe(BENCH)
  })

  it('warm-ups never make a record, and count in volume only when asked', () => {
    const heavy = { ...p, workouts: [logged(BENCH, 100, [5, 5, 5], NOW - 86400000)] }
    let s = startSession(heavy, ['r1'], '2026-11-02', '', NOW)
    s = { ...s, entries: s.entries.map(e => ({ ...e, sets: e.sets.map((x, i) => (i === 0 ? { ...x, w: 200, r: 1, done: true } : x)) })) }
    const w = draftWorkout(heavy, s, { now: NOW })
    expect(w.prs).toEqual([])
    expect(w.vol).toBe(0)
    expect(draftWorkout({ ...heavy, settings: { ...heavy.settings, volumeWarmups: true } }, s, { now: NOW }).vol).toBe(200)
  })

  it('reports an estimated 1RM record separately', () => {
    const base = profile([slot({ weight: 60 })], { workouts: [logged(BENCH, 60, [3, 3, 3], NOW - 86400000)] })
    let s = startSession(base, ['r1'], '2026-11-02', '', NOW)
    s = { ...s, entries: s.entries.map(e => ({ ...e, sets: [{ w: 60, r: 8, done: true }] })) }
    const w = draftWorkout(base, s, { now: NOW })
    expect(w.prs).toEqual([])
    expect(w.e1prs).toEqual([BENCH])
  })

  it('assisted load is not volume', () => {
    const e: Entry = { exId: BENCH, target: slot({ assisted: true }), sets: [{ w: 20, r: 10, done: true, drops: [{ w: 10, r: 5 }] }] }
    expect(sessionVolume([e], false)).toBe(0)
  })

  it('saves the workout, ends the session and updates exWeights', () => {
    let s = startSession(profile([slot()], { workouts: [prior] }), ['r1'], '2026-11-02', '', NOW)
    const base = profile([slot()], { workouts: [prior], active: s })
    s = tickAll(s, base.settings)
    const w = draftWorkout(base, s, { now: NOW + 60000, note: ' good ' })
    const out = finishSession(base, w, NOW + 60000)
    expect(out.active).toBeNull()
    expect(out.workouts).toHaveLength(2)
    expect(out.workouts[1].note).toBe('good')
    expect(out.exWeights[BENCH]).toEqual({ w: 62.5, date: '2026-11-02' })
  })

  it('noProg leaves weights and the next prescription alone', () => {
    let s = startSession(p, ['r1'], '2026-11-02', '', NOW)
    s = tickAll(s, p.settings)
    const w = draftWorkout(p, s, { now: NOW + 60000, noProg: true })
    expect(w.noProg).toBe(true)
    expect(finishSession(p, w, NOW).exWeights).toEqual({})
    expect(nextTime(p, w)[0].rx).toMatchObject({ weight: 62.5, why: 'load' })
    const counted = draftWorkout(p, s, { now: NOW + 60000 })
    expect(nextTime(p, counted)[0].rx).toMatchObject({ weight: 65, why: 'load' })
  })

  it('a past day is dated that day', () => {
    let s = startSession(profile(), ['r1'], '2026-10-20', '', NOW)
    s = tickNext(s, p.settings, NOW)
    const w = draftWorkout(profile(), s, { now: NOW + 60000 })
    expect(w.date).toBe('2026-10-20')
    expect(new Date(w.start).getDate()).toBe(20)
    expect(w.end).toBe(w.start)
  })

  it('a forgotten session ends at its last tick', () => {
    let s = startSession(profile(), ['r1'], '2026-11-02', '', NOW)
    s = tickNext(s, p.settings, NOW + 60000)
    expect(draftWorkout(profile(), s, { now: NOW + 86400000 }).end).toBe(NOW + 60000)
  })

  it('compares with the previous session of the routine', () => {
    let s = startSession(p, ['r1'], '2026-11-02', '', NOW)
    s = tickAll(s, p.settings)
    const w = draftWorkout(p, s, { now: NOW + 60000 })
    expect(previousOfRoutine(p, w)).toMatchObject({ date: '2026-10-20', sets: 3 })
    const free = startSession(p, [], '2026-11-02', 'Free', NOW)
    expect(previousOfRoutine(p, draftWorkout(p, free, { now: NOW }))).toBeNull()
  })

  it('offers exercises added on the fly for the routine', () => {
    let s = addExercise(p, startSession(p, ['r1'], '2026-11-02', '', NOW), SQUAT)
    s = { ...s, entries: s.entries.map(e => (e.exId === SQUAT ? { ...e, sets: e.sets.map(x => ({ ...x, w: 80, r: 8, done: true })) } : e)) }
    const w = draftWorkout(p, s, { now: NOW })
    const added = addedEntries(w)
    expect(added.map(e => e.exId)).toEqual([SQUAT])
    const next = addToRoutine(p, 'r1', added, NOW)
    expect(next.routines[0].ex.at(-1)).toMatchObject({ exId: SQUAT, weight: 80 })
    expect(addToRoutine(next, 'r1', added, NOW)).toBe(next)
  })

  it('freestyle starts empty', () => {
    const s = startSession(p, [], '2026-11-02', 'Free', NOW)
    expect(s.entries).toEqual([])
    expect(s.name).toBe('Free')
    expect(nextPending(s)).toBeNull()
  })
})

describe('effort feeds progression', () => {
  const s = slot()
  const entry = (rate: Partial<Entry['sets'][number]>): Entry => ({ exId: BENCH, target: s, rx: { sets: 3, reps: 5, weight: 60 }, sets: [5, 5, 5].map(r => ({ w: 60, r, done: true, ...rate })) })
  const next = (history: Entry[], policy: 'linear' | 'greyskull' = 'linear') => nextPrescription({ slot: s, history, policy, inc: 2.5 })

  it('unrated sets progress as usual', () => {
    expect(next([entry({})])).toMatchObject({ weight: 62.5, why: 'load' })
  })

  it('an all-out session repeats once, then moves on', () => {
    expect(next([entry({ rir: 0 })])).toMatchObject({ weight: 60, why: 'effort' })
    expect(next([entry({ failure: true })])).toMatchObject({ weight: 60, why: 'effort' })
    expect(next([entry({ rpe: 10 })])).toMatchObject({ weight: 60, why: 'effort' })
    expect(next([entry({ rir: 0 }), entry({ rir: 0 })])).toMatchObject({ weight: 62.5, why: 'load' })
    expect(next([entry({ rir: 0 })], 'greyskull')).toMatchObject({ weight: 62.5, why: 'load' })
  })

  it('easy sets move two steps', () => {
    expect(next([entry({ rir: 4 })])).toMatchObject({ weight: 65, why: 'load' })
    expect(next([entry({ rir: 2 })])).toMatchObject({ weight: 62.5, why: 'load' })
  })
})

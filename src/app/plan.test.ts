import { describe, expect, it } from 'vitest'
import { exerciseById } from '../catalogue'
import { allowedPolicies, modeOf, policyOf } from '../core/progression'
import { REST, routinesForDay } from '../core/schedule'
import type { Profile, Routine, Workout } from '../core/types'
import { addWeighIn, copyRoutine, isHeatSeason, moveSession, nextTraining, plannedOn, removeRoutine, setDayOverride, setScheduleMode, todayState, weekStrip, weightTrend } from './plan'
import { buildPlanFile, mergePlanFile, parsePlanFile, planSummary, telegramShareUrl } from './planFile'
import { PROGRAMS, installProgram, legacyProgram, programById, recommendProgram, type Answers } from './programs'
import { emptyProfile } from './profile'
import { fmtDate, weekdayName } from './format'
import { moveItem, newSlot, normalizeSupersets, parsePyramid, sanitizeSlot, toggleSuperset } from './slots'

const counter = () => {
  let n = 0
  return () => `id${++n}`
}
const NOW = new Date(2026, 10, 2, 9).getTime()
const blank = (): Profile => emptyProfile(NOW, 'uz')
const prog = (id: string) => programById(id)!
const workout = (id: string, date: string, routineIds: string[], start = NOW + 1000): Workout => ({
  id, date, start, end: start, routineIds, name: '', entries: [], prs: [], vol: 0, updatedAt: start,
})

describe('starter programs', () => {
  it('has the 8 agreed programs', () => {
    expect(PROGRAMS.map(x => x.id).sort()).toEqual(['beginner-machines', 'five-by-five', 'full-body', 'glute-legs', 'home-dumbbells', 'ppl', 'ramadan-light', 'upper-lower'])
  })

  for (const x of PROGRAMS) {
    it(`${x.id}: content is valid`, () => {
      for (const l of ['uz', 'ru', 'en'] as const) {
        expect(x.name[l].trim()).not.toBe('')
        expect(x.desc[l].length).toBeGreaterThan(40)
        for (const r of x.routines) expect(r.name[l].trim()).not.toBe('')
      }
      expect(/[Ѐ-ӿ]/.test(x.desc.uz + x.name.uz)).toBe(false)
      const ids = new Set(x.routines.map(r => r.id))
      const scheduled = x.schedule === 'week' ? Object.values(x.week ?? {}).flat() : (x.rotation ?? []).filter(i => i !== REST)
      expect(scheduled.length).toBeGreaterThan(0)
      for (const id of scheduled) expect(ids.has(id), id).toBe(true)
      if (x.schedule === 'week') expect(Object.keys(x.week ?? {}).length).toBe(x.days)
      for (const r of x.routines) {
        for (const s of r.ex) {
          expect(exerciseById(s.exId), s.exId).toBeTruthy()
          for (const sub of s.subs ?? []) expect(exerciseById(sub), sub).toBeTruthy()
          expect((s.subs ?? []).length).toBeLessThanOrEqual(5)
          if (s.prog) expect(allowedPolicies(modeOf(s))).toContain(s.prog)
          expect(sanitizeSlot(s)).toEqual(s)
        }
        const groups = new Map<string, number>()
        for (const s of r.ex) if (s.sg) groups.set(s.sg, (groups.get(s.sg) ?? 0) + 1)
        for (const n of groups.values()) expect(n).toBeGreaterThan(1)
      }
    })
  }

  it('installs into editable routines with new ids and a week schedule', () => {
    const p = installProgram(blank(), prog('ppl'), 'ru', 'replace', NOW, counter())
    expect(p.routines.map(r => r.id)).toEqual(['id1', 'id2', 'id3'])
    expect(p.routines[0].name).toBe('Жимовые')
    expect(p.routines[0].updatedAt).toBe(NOW)
    expect(p.scheduleMode).toBe('week')
    expect(p.week[1]).toEqual(['id1'])
    expect(p.week[6]).toEqual(['id3'])
    expect(p.rotation).toBeNull()
    expect(p.planId).toBe('ppl')
    expect(p.onboardedAt).toBe(NOW)
    p.routines[0].ex[0].sets = 99
    expect(prog('ppl').routines[0].ex[0].sets).toBe(4)
  })

  it('installs a rotation program with its rests', () => {
    const p = installProgram(blank(), prog('full-body'), 'en', 'replace', NOW, counter())
    expect(p.scheduleMode).toBe('rotation')
    expect(p.rotation?.sequence.slice(0, 3)).toEqual(['id1', REST, 'id2'])
    expect(p.rotation?.since).toBe(NOW)
    expect(p.week).toEqual({})
  })

  it('replace removes the old routines with tombstones and clears overrides', () => {
    const a = installProgram(blank(), prog('ppl'), 'en', 'replace', NOW, counter())
    const withOverride = setDayOverride(a, '2026-11-03', REST)
    const makeId = () => `new-${Math.random()}`
    const b = installProgram(withOverride, prog('upper-lower'), 'en', 'replace', NOW + 1, makeId)
    expect(b.routines.length).toBe(4)
    expect(Object.keys(b.deleted.routines)).toEqual(['id1', 'id2', 'id3'])
    expect(b.dayPlan).toEqual({})
    expect(b.week[3]).toBeUndefined()
  })

  it('add keeps routines and only fills free weekdays', () => {
    const a = installProgram(blank(), prog('beginner-machines'), 'en', 'replace', NOW, counter())
    let n = 100
    const b = installProgram(a, prog('upper-lower'), 'en', 'add', NOW + 1, () => `x${++n}`)
    expect(b.routines.length).toBe(7)
    expect(b.week[1]).toEqual(a.week[1])
    expect(b.week[2]?.[0]).toMatch(/^x/)
    expect(b.week[4]?.[0]).toMatch(/^x/)
    expect(b.planId).toBe('beginner-machines')
  })

  it('add leaves a running loop alone', () => {
    const a = installProgram(blank(), prog('full-body'), 'en', 'replace', NOW, counter())
    const b = installProgram(a, prog('ppl'), 'en', 'add', NOW + 1, () => `y${Math.random()}`)
    expect(b.rotation).toEqual(a.rotation)
    expect(b.scheduleMode).toBe('rotation')
    expect(b.routines.length).toBe(5)
  })

  const recommend = (a: Partial<Answers>) => recommendProgram({ goal: 'muscle', level: 'beginner', days: 3, place: 'gym', ...a }).id

  it('recommends by answers', () => {
    expect(recommend({ place: 'home', goal: 'strength', level: 'intermediate', days: 6 })).toBe('home-dumbbells')
    expect(recommend({ goal: 'strength' })).toBe('five-by-five')
    expect(recommend({ goal: 'strength', level: 'intermediate', days: 4 })).toBe('upper-lower')
    expect(recommend({ goal: 'muscle', level: 'intermediate', days: 6 })).toBe('ppl')
    expect(recommend({ goal: 'muscle', days: 6 })).toBe('upper-lower')
    expect(recommend({ goal: 'muscle', days: 2 })).toBe('full-body')
    expect(recommend({ goal: 'fitness', days: 5 })).toBe('beginner-machines')
    expect(recommend({ goal: 'fitness', level: 'intermediate', days: 3 })).toBe('full-body')
  })

  it('every answer combination gets a program', () => {
    for (const goal of ['strength', 'muscle', 'fitness'] as const)
      for (const level of ['beginner', 'intermediate'] as const)
        for (const place of ['gym', 'home'] as const)
          for (const days of [2, 3, 4, 5, 6]) expect(recommendProgram({ goal, level, days, place })).toBeTruthy()
  })

  it('maps the first version plan ids', () => {
    expect(legacyProgram('5x5')?.id).toBe('five-by-five')
    expect(legacyProgram('ppl')?.id).toBe('ppl')
    expect(legacyProgram('nope')).toBeUndefined()
    expect(legacyProgram()).toBeUndefined()
  })
})

describe('slot helpers', () => {
  it('clamps numbers and drops what the mode cannot use', () => {
    const s = sanitizeSlot({ exId: 'x', sets: 99, reps: 500, repsMin: 800, weight: -5, sec: 40, prog: 'time', restSec: 5000, warmups: 99 })
    expect(s).toEqual({ exId: 'x', mode: 'time', sets: 20, reps: 0, sec: 40, weight: 0, prog: 'time', restSec: 900 })
  })

  it('keeps a valid rep range and forgets an inverted one', () => {
    expect(sanitizeSlot({ exId: 'x', sets: 3, reps: 12, repsMin: 8, weight: 20 }).repsMin).toBe(8)
    expect(sanitizeSlot({ exId: 'x', sets: 3, reps: 8, repsMin: 12, weight: 20 }).repsMin).toBeUndefined()
  })

  it('allows only policies of the mode', () => {
    expect(sanitizeSlot({ exId: 'x', mode: 'cardio', sets: 1, reps: 0, min: 10, weight: 0, prog: 'linear' }).prog).toBeUndefined()
    expect(sanitizeSlot({ exId: 'x', sets: 3, reps: 5, weight: 0, prog: 'time' }).prog).toBeUndefined()
    expect(sanitizeSlot({ exId: 'x', sets: 3, reps: 5, weight: 0, prog: 'greyskull' }).prog).toBe('greyskull')
  })

  it('caps backups at 5, without duplicates or itself', () => {
    const s = sanitizeSlot({ exId: 'x', sets: 3, reps: 5, weight: 0, subs: ['x', 'a', 'a', 'b', 'c', 'd', 'e', 'f'] })
    expect(s.subs).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('load kinds exclude each other and rest off wins', () => {
    const s = sanitizeSlot({ exId: 'x', sets: 3, reps: 5, weight: 0, bodyweight: true, assisted: true, restOff: true, restSec: 60 })
    expect(s.assisted).toBe(true)
    expect(s.bodyweight).toBeUndefined()
    expect(s.restSec).toBeUndefined()
  })

  it('drop-set gets its defaults, rest-pause has none', () => {
    expect(sanitizeSlot({ exId: 'x', sets: 3, reps: 5, weight: 0, intensifier: 'dropset' })).toMatchObject({ dropCount: 2, dropPct: 20 })
    expect(sanitizeSlot({ exId: 'x', sets: 3, reps: 5, weight: 0, intensifier: 'restpause' }).dropCount).toBeUndefined()
  })

  it('a pyramid sets the set count and turns progression off', () => {
    const s = sanitizeSlot({ exId: 'x', sets: 3, reps: 10, weight: 0, pyramid: parsePyramid('12, 10 8;max junk 0') })
    expect(s.pyramid).toEqual([12, 10, 8, 'max'])
    expect(s.sets).toBe(4)
    expect(policyOf(s, 'linear')).toBe('off')
  })

  it('new slots fit the exercise category', () => {
    expect(modeOf(newSlot('a', 'cardio'))).toBe('cardio')
    expect(modeOf(newSlot('a', 'stretching'))).toBe('time')
    expect(modeOf(newSlot('a', 'strength'))).toBe('reps')
  })

  const slots = (...sg: (string | undefined)[]) => sg.map((x, i) => ({ exId: `e${i}`, sets: 1, reps: 1, weight: 0, ...(x ? { sg: x } : {}) }))
  const groups = (ex: { sg?: string }[]) => ex.map(s => s.sg ?? '-').join('')

  it('moves items within bounds', () => {
    expect(moveItem([1, 2, 3], 0, 2)).toEqual([2, 3, 1])
    expect(moveItem([1, 2, 3], 2, 5)).toEqual([1, 2, 3])
  })

  it('a superset needs two neighbours; a split run gets its own id', () => {
    expect(groups(normalizeSupersets(slots('a', undefined, 'b', 'b')))).toBe('--bb')
    const split = normalizeSupersets(slots('a', 'a', undefined, 'a', 'a'))
    expect(split[0].sg).toBe('a')
    expect(split[3].sg).toBe(split[4].sg)
    expect(split[3].sg).not.toBe('a')
  })

  it('links and unlinks neighbours', () => {
    const linked = toggleSuperset(slots(undefined, undefined, undefined), 0)
    expect(groups(linked)).toBe('aa-')
    const three = toggleSuperset(linked, 1)
    expect(groups(three)).toBe('aaa')
    const parted = toggleSuperset(three, 0)
    expect(parted[0].sg).toBeUndefined()
    expect(parted[1].sg).toBe(parted[2].sg)
    expect(parted[1].sg).toBeTruthy()
  })
})

describe('schedule helpers', () => {
  const r = (id: string): Routine => ({ id, name: id.toUpperCase(), ex: [], updatedAt: NOW })
  const today = '2026-11-02' // a Monday
  const weekly = (): Profile => ({ ...blank(), routines: [r('a'), r('b')], week: { 1: ['a'], 3: ['b'] } })
  const looped = (sequence: string[], workouts: Workout[] = []): Profile => ({
    ...blank(), routines: [r('a'), r('b')], scheduleMode: 'rotation', rotation: { id: 'l', sequence, since: NOW }, workouts,
  })

  it('moving a session overrides both days and leaves the week alone', () => {
    const p = moveSession(weekly(), today, 'a', '2026-11-03', today)
    expect(routinesForDay(p, today, today)).toEqual([])
    expect(routinesForDay(p, '2026-11-03', today)).toEqual(['a'])
    expect(p.week[1]).toEqual(['a'])
    expect(routinesForDay(p, '2026-11-09', today)).toEqual(['a'])
  })

  it('moving onto a planned day swaps the two', () => {
    const p = moveSession(weekly(), today, 'a', '2026-11-04', today)
    expect(routinesForDay(p, today, today)).toEqual(['b'])
    expect(routinesForDay(p, '2026-11-04', today)).toEqual(['a'])
  })

  it('a rest override wins and can be cleared', () => {
    const p = setDayOverride(weekly(), today, REST)
    expect(plannedOn(p, today, today)).toEqual([])
    expect(plannedOn(setDayOverride(p, today, null), today, today)).toEqual(['a'])
  })

  it('projects the loop forward with its rests', () => {
    const p = looped(['a', REST, 'b', REST])
    expect(plannedOn(p, today, today)).toEqual(['a'])
    expect(plannedOn(p, '2026-11-03', today)).toEqual([])
    expect(plannedOn(p, '2026-11-04', today)).toEqual(['b'])
    expect(plannedOn(p, '2026-11-06', today)).toEqual(['a'])
    expect(plannedOn(p, '2026-11-01', today)).toEqual([])
  })

  it('a finished today moves the loop on', () => {
    const p = looped(['a', REST, 'b', REST], [workout('w', today, ['a'])])
    expect(todayState(p, today).status).toBe('done')
    expect(plannedOn(p, today, today)).toEqual([])
    expect(plannedOn(p, '2026-11-03', today)).toEqual([])
    expect(plannedOn(p, '2026-11-04', today)).toEqual(['b'])
    expect(nextTraining(p, today)).toEqual({ date: '2026-11-04', routineIds: ['b'] })
  })

  it('a late loop asks for its session today', () => {
    const p = looped(['a', REST, 'b'], [workout('w', '2026-10-20', ['a'], NOW + 5)])
    expect(plannedOn(p, today, today)).toEqual(['b'])
  })

  it('today states for the week mode', () => {
    expect(todayState(weekly(), today).status).toBe('train')
    expect(todayState(weekly(), '2026-11-03').status).toBe('rest')
    expect(todayState({ ...weekly(), workouts: [workout('w', today, ['a'])] }, today).status).toBe('done')
    expect(nextTraining(weekly(), today)?.date).toBe('2026-11-04')
  })

  it('the week strip starts on the chosen day and labels each day', () => {
    const p = { ...weekly(), workouts: [workout('w', '2026-11-04', ['b'])] }
    const now = new Date(2026, 10, 5, 9)
    const days = weekStrip(p, now)
    expect(days[0].date).toBe('2026-11-02')
    expect(days.map(d => d.status)).toEqual(['missed', 'rest', 'done', 'rest', 'rest', 'rest', 'rest'])
    expect(days[3].isToday).toBe(true)
    const sunday = weekStrip({ ...p, settings: { ...p.settings, weekStart: 0 } }, now)
    expect(sunday[0].date).toBe('2026-11-01')
  })

  it('switching to rotation builds a loop from the week', () => {
    const p = setScheduleMode(weekly(), 'rotation', NOW)
    expect(p.rotation?.sequence).toEqual(['a', REST, 'b', REST, REST, REST, REST])
    const back = setScheduleMode(p, 'week', NOW)
    expect(back.week).toEqual(p.week)
    expect(setScheduleMode(back, 'rotation', NOW + 9).rotation).toEqual(p.rotation)
  })

  it('deleting a routine removes it from every schedule', () => {
    const p = { ...setDayOverride(weekly(), today, 'a'), rotation: { id: 'l', sequence: ['a', REST, 'b'], since: NOW } }
    const next = removeRoutine(p, 'a', NOW)
    expect(next.routines.map(x => x.id)).toEqual(['b'])
    expect(next.week[1]).toEqual([])
    expect(next.dayPlan[today]).toBeUndefined()
    expect(next.rotation?.sequence).toEqual([REST, 'b'])
    expect(next.deleted.routines.a).toBe(NOW)
  })

  it('copies a routine right after the original', () => {
    const p = copyRoutine(weekly(), 'a', 'copy', NOW, () => 'c')
    expect(p.routines.map(x => x.id)).toEqual(['a', 'c', 'b'])
    expect(p.routines[1].name).toBe('A (copy)')
  })

  it('one weigh-in a day, trend against the previous one', () => {
    let p = addWeighIn(blank(), 80, '2026-11-01', NOW)
    expect(weightTrend(p)).toEqual({ last: 80, date: '2026-11-01', delta: null })
    p = addWeighIn(p, 81, today, NOW)
    p = addWeighIn(p, 79.5, today, NOW + 1)
    expect(p.bodyweight.length).toBe(2)
    expect(weightTrend(p)).toEqual({ last: 79.5, date: today, delta: -0.5 })
  })

  it('heat season is June to August', () => {
    expect(isHeatSeason(new Date(2026, 5, 1))).toBe(true)
    expect(isHeatSeason(new Date(2026, 7, 31))).toBe(true)
    expect(isHeatSeason(new Date(2026, 8, 1))).toBe(false)
    expect(isHeatSeason(new Date(2026, 4, 31))).toBe(false)
  })
})

describe('plan file', () => {
  it('round-trips a week plan', () => {
    const src = installProgram(blank(), prog('ppl'), 'en', 'replace', NOW, counter())
    const parsed = parsePlanFile(JSON.stringify(buildPlanFile(src)))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.dropped).toEqual([])
    expect(parsed.file.routines.map(r => r.ex)).toEqual(src.routines.map(r => r.ex))
    let n = 0
    const merged = mergePlanFile(blank(), parsed.file, NOW, () => `m${++n}`)
    expect(merged.routines.map(r => r.name)).toEqual(['Push', 'Pull', 'Legs'])
    expect(merged.routines[0].id).toBe('m1')
    expect(merged.week[1]).toEqual(['m1'])
    expect(merged.scheduleMode).toBe('week')
  })

  it('round-trips a rotation plan', () => {
    const src = installProgram(blank(), prog('five-by-five'), 'en', 'replace', NOW, counter())
    const parsed = parsePlanFile(JSON.stringify(buildPlanFile(src)))
    if (!parsed.ok) throw new Error('parse')
    expect(parsed.file.week).toBeUndefined()
    const merged = mergePlanFile(blank(), parsed.file, NOW, counter())
    expect(merged.scheduleMode).toBe('rotation')
    expect(merged.rotation?.sequence.filter(x => x !== REST).length).toBe(6)
  })

  it('merging adds new ids and keeps what the user has', () => {
    const mine = installProgram(blank(), prog('beginner-machines'), 'en', 'replace', NOW, counter())
    const parsed = parsePlanFile(JSON.stringify(buildPlanFile(mine)))
    if (!parsed.ok) throw new Error('parse')
    let n = 0
    const merged = mergePlanFile(mine, parsed.file, NOW, () => `z${++n}`)
    expect(merged.routines.length).toBe(6)
    expect(merged.week).toEqual(mine.week)
  })

  it('drops unknown exercises and reports them', () => {
    const text = JSON.stringify({
      kind: 'gym-dtwin-plan', v: 1, unit: 'kg',
      routines: [{ id: 'r', name: 'R', ex: [
        { exId: 'Plank', sets: 1, reps: 0, sec: 30, weight: 0, subs: ['Nope_1', 'Pushups'] },
        { exId: 'Nope_2', sets: 3, reps: 5, weight: 0 },
      ] }],
      week: { 1: ['r', 'ghost'], 9: ['r'], __proto__: ['r'] },
    })
    const parsed = parsePlanFile(text)
    if (!parsed.ok) throw new Error('parse')
    expect(parsed.dropped.sort()).toEqual(['Nope_1', 'Nope_2'])
    expect(parsed.file.routines[0].ex.length).toBe(1)
    expect(parsed.file.routines[0].ex[0].subs).toEqual(['Pushups'])
    expect(parsed.file.week?.[1]).toEqual(['r'])
    expect(parsed.file.week?.[9]).toBeUndefined()
  })

  it('rejects anything that is not a plan file', () => {
    for (const bad of ['', 'not json', '[]', '{"kind":"other","v":1,"routines":[]}', '{"kind":"gym-dtwin-plan","v":2,"routines":[]}', '{"kind":"gym-dtwin-plan","v":1}']) {
      expect(parsePlanFile(bad).ok).toBe(false)
    }
  })

  it('sanitizes bad numbers and converts units on import', () => {
    const text = JSON.stringify({ kind: 'gym-dtwin-plan', v: 1, unit: 'lb', routines: [{ id: 'r', name: 'x'.repeat(200), glyph: 'ABCDEF', prog: 'nope', ex: [{ exId: 'Plank', sets: 'many', reps: 5, weight: 100, sec: 30 }] }] })
    const parsed = parsePlanFile(text)
    if (!parsed.ok) throw new Error('parse')
    const r = parsed.file.routines[0]
    expect(r.name.length).toBe(80)
    expect(r.glyph).toBe('ABC')
    expect(r.prog).toBeUndefined()
    expect(r.ex[0].sets).toBe(3)
    const merged = mergePlanFile(blank(), parsed.file, NOW, counter())
    expect(merged.routines[0].ex[0].weight).toBeCloseTo(45.25, 2)
  })

  it('summarises the plan for sharing', () => {
    const week = installProgram(blank(), prog('beginner-machines'), 'en', 'replace', NOW, counter())
    const text = planSummary(week, d => `D${d}`, 'rest')
    expect(text.split('\n')).toEqual(['D1: Machines 1', 'D3: Machines 2', 'D5: Machines 3'])
    const loop = installProgram(blank(), prog('five-by-five'), 'en', 'replace', NOW, counter())
    expect(planSummary(loop, d => `D${d}`, 'rest').startsWith('Workout A > rest > Workout B')).toBe(true)
    const url = telegramShareUrl('https://gym.dtwin.uz', 'A & B')
    expect(url).toBe('https://t.me/share/url?url=https%3A%2F%2Fgym.dtwin.uz&text=A%20%26%20B')
  })
})

describe('dates', () => {
  it('formats Uzbek without relying on browser locale data', () => {
    expect(fmtDate('2026-11-02', 'uz')).toBe('2 noy 2026')
    expect(fmtDate('2026-11-02', 'uz', { weekday: 'long', day: 'numeric', month: 'long' })).toBe('dushanba, 2 noyabr')
    expect(fmtDate('2026-11-02', 'uz', { weekday: 'short' })).toBe('Du')
    expect(fmtDate('2026-11-08', 'uz', { day: 'numeric', month: 'short' })).toBe('8 noy')
  })

  it('names every weekday by its number', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(d => weekdayName(d, 'uz', 'short'))).toEqual(['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'])
    expect(weekdayName(0, 'en')).toBe('Sunday')
    expect(weekdayName(1, 'ru')).toBe('понедельник')
  })
})

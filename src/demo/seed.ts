import { programById, installProgram } from '../app/programs'
import { emptyProfile } from '../app/profile'
import { draftWorkout, finishSession, startSession } from '../app/session'
import { addDays, isoDate, parseIso } from '../core/history'
import type { ActiveSession, CustomExercise, ISODate, Measurement, Ms, Profile, Routine, SetRow, Slot, WeighIn } from '../core/types'

/**
 * A fictional lifter's last five months, played through the real session engine:
 * every workout is started, logged and finished the way the app does it, so
 * progression, records, deloads and statistics come out exactly as they would for a person.
 */

const DAY = 86_400_000
const WEEKS = 36

/** Small deterministic generator: the same demo on every reload. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Working weights the lifter started the block with. */
const START_KG: Record<string, number> = {
  'Barbell_Bench_Press_-_Medium_Grip': 70,
  Bent_Over_Barbell_Row: 55,
  Dumbbell_Shoulder_Press: 16,
  'Wide-Grip_Lat_Pulldown': 50,
  'EZ-Bar_Curl': 25,
  'EZ-Bar_Skullcrusher': 22.5,
  Barbell_Squat: 95,
  Romanian_Deadlift: 70,
  Lying_Leg_Curls: 32.5,
  Standing_Calf_Raises: 60,
  Standing_Military_Press: 37.5,
  Incline_Dumbbell_Press: 20,
  Seated_Cable_Rows: 50,
  Side_Lateral_Raise: 8,
  Face_Pull: 20,
  Barbell_Deadlift: 120,
  Leg_Press: 140,
  Split_Squat_with_Dumbbells: 12,
  Seated_Leg_Curl: 35,
  Seated_Calf_Raise: 40,
  Hammer_Curls: 12,
  Cable_Crossover: 15,
  'Triceps_Pushdown_-_Rope_Attachment': 22.5,
  Barbell_Hip_Thrust: 80,
}

const CUSTOM: CustomExercise[] = [
  { id: 'custom-sledge', name: 'Bolg\'a bilan shina urish', bodyPart: 'core', equipment: 'other', primary: ['abdominals'], secondary: ['shoulders', 'forearms'], category: 'strongman' },
  { id: 'custom-rope', name: 'Og\'ir arqon to\'lqini', bodyPart: 'shoulders', equipment: 'other', primary: ['shoulders'], secondary: ['abdominals', 'forearms'], category: 'cardio' },
  { id: 'custom-farmer', name: 'Fermer yurishi (gantel)', bodyPart: 'arms', equipment: 'dumbbell', primary: ['forearms'], secondary: ['traps', 'abdominals'], category: 'strongman' },
]

/** A Saturday arm day the lifter built on top of the program: superset, drop set, rest-pause. */
function armsRoutine(now: Ms): Routine {
  const ex: Slot[] = [
    { exId: 'Hammer_Curls', sets: 3, reps: 12, repsMin: 8, weight: 0, sg: 'a', restSec: 60 },
    { exId: 'Triceps_Pushdown_-_Rope_Attachment', sets: 3, reps: 12, repsMin: 8, weight: 0, sg: 'a', restSec: 60 },
    { exId: 'Cable_Crossover', sets: 3, reps: 15, repsMin: 10, weight: 0, intensifier: 'dropset', dropCount: 2, dropPct: 20, restSec: 75 },
    { exId: 'Barbell_Hip_Thrust', sets: 3, reps: 10, weight: 0, intensifier: 'restpause', restSec: 120, prog: 'linear', inc: 5 },
    { exId: 'custom-farmer', mode: 'time', sets: 3, reps: 0, sec: 40, weight: 20, prog: 'time', restSec: 90 },
    { exId: 'Walking_Treadmill', mode: 'cardio', sets: 1, reps: 0, min: 15, speed: 6, incline: 8, weight: 0, prog: 'off', restOff: true },
  ]
  return { id: 'demo-arms', name: 'Qo\'l + kardio', glyph: 'Q', prog: 'double', ex, updatedAt: now }
}

const NOTES = [
  'Uyqu yaxshi edi, hammasi yengil ketdi.',
  'Zal gavjum, skameyka navbat bilan.',
  'Tizzada biroz noqulaylik, chuqur o\'tirmadim.',
  'Ro\'za kuni emas, lekin kech ovqatlandim.',
  'Yangi krossovka, oyoq barqarorroq.',
  'Ish ko\'p, mashg\'ulot qisqaroq bo\'ldi.',
  'Shaxsiy rekord! Kayfiyat zo\'r.',
  'Issiq, ko\'proq suv ichdim.',
]

/** What the lifter can really move on a day: it grows slowly, the plan sometimes runs ahead of it. */
const capacity = (exId: string, progress: number) => (START_KG[exId] ?? 0) * (1.06 + 0.2 * progress)

function playSession(p: Profile, s: ActiveSession, r: () => number, end: Ms, note?: string, progress = 1): Profile {
  const tired = r() < 0.08
  const entries = s.entries.map((e, ei) => {
    const mode = e.target?.mode ?? 'reps'
    const sets = e.sets.map((row, si): SetRow => {
      const next: SetRow = { ...row, done: true }
      if (mode === 'cardio') {
        next.min = (row.min ?? 15) + Math.round(r() * 5)
        next.km = Math.round((next.min / 60) * (row.speed ?? 6) * 10) / 10
      } else if (mode === 'time') {
        next.sec = Math.max(20, (row.sec ?? 40) - (tired && si === e.sets.length - 1 ? 10 : 0))
      } else if (!row.warmup) {
        const lastWork = si === e.sets.length - 1
        const cap = capacity(e.exId, progress) * (0.98 + r() * 0.05)
        const over = cap > 0 && (row.w ?? 0) > cap
        const miss = (over && si >= e.sets.length - 2) || (tired && lastWork && ei < 3)
        if (miss && row.r) {
          next.r = Math.max(1, row.r - 1 - Math.floor(r() * 2))
          next.failure = true
        } else {
          next.rir = lastWork ? Math.floor(r() * 2) : 1 + Math.floor(r() * 3)
        }
      }
      if (row.sides) {
        next.sides = { L: { ...row.sides.L, done: true }, R: { ...row.sides.R, done: true } }
      }
      return next
    })
    return { ...e, sets }
  })
  const done: ActiveSession = { ...s, entries, lastAt: end }
  const w = draftWorkout(p, done, { now: end, note })
  return finishSession(p, w, end)
}

function weighIns(today: ISODate, r: () => number): WeighIn[] {
  const out: WeighIn[] = []
  for (let d = WEEKS * 7; d >= 1; d -= 3 + Math.floor(r() * 2)) {
    const date = addDays(today, -d)
    const trend = 86.2 - ((WEEKS * 7 - d) / (WEEKS * 7)) * 6
    out.push({ date, w: Math.round((trend + (r() - 0.5) * 0.8) * 10) / 10, t: parseIso(date).getTime() + 7.5 * 3_600_000 })
  }
  return out
}

function measurements(today: ISODate): Measurement[] {
  const out: Measurement[] = []
  for (let m = 8; m >= 0; m--) {
    const date = addDays(today, -m * 28 - 2)
    const r2 = (n: number) => Math.round(n * 10) / 10
    const k = (8 - m) * 0.7
    out.push({
      date, t: parseIso(date).getTime() + 8 * 3_600_000,
      values: {
        waist: r2(93 - k * 1.2), chest: r2(104 + k * 0.4), hip: r2(102 - k * 0.5), thigh: r2(59 + k * 0.3),
        arm: r2(36 + k * 0.3), calf: r2(38.5 + k * 0.1), neck: 39.5, ...(m <= 5 ? { forearm: r2(30 + (5 - m) * 0.2) } : {}),
      },
    })
  }
  return out
}

export function demoProfile(now: Ms = Date.now()): Profile {
  const r = rng(20261117)
  const today = isoDate(new Date(now))
  const first = addDays(today, -WEEKS * 7)
  const t0 = parseIso(first).getTime()

  const program = programById('upper-lower')
  let p = emptyProfile(t0, 'uz')
  p.settings = { ...p.settings, theme: 'dark', effort: 'rir', weighIn: true, safetyAck: t0, weightGoal: 'lose', logRef: 'last' }
  if (program) p = installProgram(p, program, 'uz', 'replace', t0, (() => { let n = 0; return () => `demo-r${++n}` })())
  const arms = armsRoutine(t0)
  p.routines = [...p.routines, arms]
  p.week = { ...p.week, 6: [arms.id] }
  p.customEx = CUSTOM.map(c => ({ ...c, updatedAt: t0 }))
  p.exWeights = Object.fromEntries(Object.entries(START_KG).map(([id, w]) => [id, { w, date: first }]))
  p.bodyweight = []
  p.targetW = 78

  const weights = weighIns(today, r)
  let wi = 0
  let ni = 0
  let sessionNo = 0

  for (let day = 0; day < WEEKS * 7; day++) {
    const date = addDays(first, day)
    const dayStart = parseIso(date).getTime()
    while (wi < weights.length && weights[wi].t <= dayStart + 12 * 3_600_000) p.bodyweight = [...p.bodyweight, weights[wi++]]
    const weekday = parseIso(date).getDay()
    let ids = p.week[weekday] ?? []
    if (!ids.length) continue
    const week = Math.floor(day / 7)
    // a week off with a cold, the odd skipped day, and arm day only every other Saturday
    if (week === 20 || (weekday === 6 && week % 2 === 1) || r() < 0.07) continue
    // one Tuesday moved to Wednesday, as the planner allows
    if (week === 27 && weekday === 2) ids = []
    if (!ids.length) continue
    const start = dayStart + (18 + Math.floor(r() * 3)) * 3_600_000 + Math.floor(r() * 50) * 60_000
    const end = start + (52 + Math.floor(r() * 30)) * 60_000
    const s = startSession(p, ids, date, 'Erkin mashg\'ulot', start, () => `demo-w${++sessionNo}`)
    const note = r() < 0.22 ? NOTES[ni++ % NOTES.length] : undefined
    p = playSession(p, s, r, end, note, day / (WEEKS * 7))
  }

  // a free-style session with the custom exercises
  const freeDate = addDays(today, -4)
  const freeStart = parseIso(freeDate).getTime() + 10 * 3_600_000
  const free = startSession(p, [], freeDate, 'Erkin: funksional', freeStart, () => 'demo-free')
  free.entries = [
    { exId: 'custom-sledge', sets: [{ r: 20, done: false }, { r: 20, done: false }, { r: 15, done: false }] },
    { exId: 'custom-rope', sets: [{ sec: 30, done: false }, { sec: 30, done: false }, { sec: 30, done: false }], target: { exId: 'custom-rope', mode: 'time', sets: 3, reps: 0, sec: 30, weight: 0 } },
    { exId: 'Pushups', sets: [{ r: 25, done: false }, { r: 20, done: false }, { r: 18, done: false }] },
  ]
  p = playSession(p, free, rng(7), freeStart + 35 * 60_000, 'Ko\'chada, bog\'da.')

  while (wi < weights.length) p.bodyweight = [...p.bodyweight, weights[wi++]]
  p.measurements = measurements(today)

  p.favEx = ['Barbell_Squat', 'Barbell_Bench_Press_-_Medium_Grip', 'Barbell_Deadlift', 'Pullups', 'Face_Pull', 'custom-farmer']
  p.exNotes = {
    Barbell_Squat: 'Poyabzal tekis, tizza oyoq uchi yo\'nalishida. Pastda 1 soniya.',
    'Barbell_Bench_Press_-_Medium_Grip': 'Kurak yig\'ilgan, oyoq polda. Sherik bilan og\'ir setlar.',
    Barbell_Deadlift: 'Kamar 140 kg dan keyin.',
  }
  p.dayNotes = {
    [addDays(today, -WEEKS * 7 + 20 * 7 + 1)]: { text: 'Shamollash, bir hafta dam.', tag: 'sick' },
    [addDays(today, -12)]: { text: 'Ish safari, Samarqand.', tag: 'travel' },
    [addDays(today, 2)]: { text: 'Do\'st bilan birga mashg\'ulot.' },
  }
  // today always has something to start, tomorrow is moved by hand
  const planned = p.week[new Date(now).getDay()] ?? []
  const upperA = p.routines[0]?.id
  if (!planned.length && upperA) p.dayPlan = { ...p.dayPlan, [today]: upperA }
  p.dayPlan = { ...p.dayPlan, [addDays(today, 3)]: 'rest' }
  p.plates = { kg: { 25: 2, 20: 4, 15: 2, 10: 4, 5: 4, 2.5: 4, 1.25: 2 } }
  p.onboardedAt = t0
  p.updatedAt = now - DAY / 24
  return p
}

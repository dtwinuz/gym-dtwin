import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../../catalogue'
import { detectRecords } from '../../core/history'
import type { Profile, Workout } from '../../core/types'
import { emptyProfile } from '../profile'
import { BACKUP_KIND, PRE_RESTORE_KEY, backupSummary, buildBackup, clearPreRestore, parseBackup, readPreRestore, stashPreRestore } from './backup'
import { decodeBytes, detectDelimiter, guardCell, parseCsv, ticker, writeCsv } from './csv'
import { bodyCsv, setsCsv } from './export'
import { detectFormat, headerKey, parseDuration, parseImport, parseNumber, parseStamp, slashIsDayFirst } from './formats'
import { applyImport, buildImport, defaultChoices, namesIn, NEW_EXERCISE, type BuildOptions } from './importer'
import { NAME_ALIASES, cleanName, matchNames } from './names'
import strongCsv from './fixtures/strong.csv?raw'
import hevyCsv from './fixtures/hevy.csv?raw'
import fitnotesCsv from './fixtures/fitnotes.csv?raw'
import genericCsv from './fixtures/generic.csv?raw'
import strong2018Csv from './fixtures/real/strong-2018.csv?raw'
import strong2019Csv from './fixtures/real/strong-2019.csv?raw'
import strong2025Csv from './fixtures/real/strong-2025.csv?raw'
import hevyUsCsv from './fixtures/real/hevy-us.csv?raw'
import hevyPlainCsv from './fixtures/real/hevy-plain.csv?raw'
import fitnotesRealCsv from './fixtures/real/fitnotes-real.csv?raw'

const makeIds = () => {
  let n = 0
  return () => `id${++n}`
}

async function load(text: string, p: Profile = emptyProfile(1, 'en')) {
  const file = await parseImport(text)
  if (!file) throw new Error('unknown format')
  const matches = await matchNames(namesIn(file), p.customEx)
  return { file, matches, choices: defaultChoices(matches) }
}

async function run(text: string, p: Profile = emptyProfile(1, 'en'), over: Partial<BuildOptions> = {}) {
  const l = await load(text, p)
  const built = buildImport(l.file, p, { ...l, defaultName: 'Imported', now: 5, makeId: makeIds(), ...over })
  return { ...l, built, profile: await applyImport(p, built, undefined, 5) }
}

const entryOf = (w: Workout, exId: string) => w.entries.find(e => e.exId === exId)!

describe('csv parser', () => {
  it('handles quotes, doubled quotes, newlines in cells and CRLF', () => {
    expect(parseCsv('a,b\r\n"x,1","y""z"\r\n"line\nbreak",2\r\n')).toEqual([['a', 'b'], ['x,1', 'y"z'], ['line\nbreak', '2']])
  })
  it('detects comma, semicolon and tab, and skips the BOM', () => {
    expect(detectDelimiter('﻿a;b;c\n1,5;2;3')).toBe(';')
    expect(detectDelimiter('a\tb\n')).toBe('\t')
    expect(detectDelimiter('a,b;c,d')).toBe(',')
    expect(parseCsv('﻿a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']])
    expect(detectDelimiter('sep=;\na,b,c')).toBe(';')
  })
  it('ignores blank lines, keeps empty cells, needs no final newline', () => {
    expect(parseCsv('a,b\n\n,\n1,\n')).toEqual([['a', 'b'], ['1', '']])
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })
  it('keeps a stray quote and survives an unterminated one', () => {
    expect(parseCsv('5" bar,2')).toEqual([['5" bar', '2']])
    expect(parseCsv('"open,2\n3')).toEqual([['open,2\n3']])
  })
  it('decodes UTF-16 and falls back from invalid UTF-8 to Windows-1251', () => {
    expect(decodeBytes(new Uint8Array([0xff, 0xfe, 0x61, 0, 0x62, 0]))).toBe('ab')
    expect(decodeBytes(new Uint8Array([0xc2, 0xe5, 0xf1]))).toBe('Вес')
    expect(decodeBytes(new TextEncoder().encode('Вес'))).toBe('Вес')
  })
  it('the ticker yields only after its budget', async () => {
    const seen: number[] = []
    const tick = ticker(n => seen.push(n), 0)
    await new Promise(r => setTimeout(r, 2))
    await tick(7)
    expect(seen).toEqual([7])
  })
})

describe('csv writer', () => {
  it('writes BOM, CRLF and RFC 4180 quoting', () => {
    expect(writeCsv([['a,b', 'c"d', 'e\nf', 1, null, undefined]])).toBe('﻿"a,b","c""d","e\nf",1,,\r\n')
  })
  it('guards formula cells but not numbers', () => {
    for (const s of ['=1+1', '+1', '-1', '@x', '\tx']) expect(guardCell(s)).toBe(`'${s}`)
    expect(guardCell('Bench')).toBe('Bench')
    expect(writeCsv([['=SUM(A1)', -5]])).toBe("﻿'=SUM(A1),-5\r\n")
    expect(writeCsv([['=A,1']])).toBe('﻿"\'=A,1"\r\n')
  })
})

describe('field parsing', () => {
  it('reads the date styles of the apps', () => {
    expect(parseStamp('2 Nov 2026, 09:30')).toEqual({ date: '2026-11-02', time: '09:30' })
    expect(parseStamp('2 Nov 2026, 9:30 PM')).toEqual({ date: '2026-11-02', time: '21:30' })
    expect(parseStamp('12 Jan 2026, 12:05 am')).toEqual({ date: '2026-01-12', time: '00:05' })
    expect(parseStamp('Nov 2, 2026')).toEqual({ date: '2026-11-02' })
    expect(parseStamp('2021-07-24 10:37:18')).toEqual({ date: '2021-07-24', time: '10:37' })
    expect(parseStamp('2026-05-11')).toEqual({ date: '2026-05-11' })
    expect(parseStamp('02.11.2026 07:05')).toEqual({ date: '2026-11-02', time: '07:05' })
    expect(parseStamp('11/02/2026')).toEqual({ date: '2026-11-02' })
    expect(parseStamp('02/11/2026', true)).toEqual({ date: '2026-11-02' })
  })
  it('rejects what is not a date', () => {
    for (const s of ['', 'soon', '2026-13-01', '2026-02-30', '31 Foo 2026']) expect(parseStamp(s)).toBeNull()
  })
  it('turns zoned times into local ones', () => {
    const local = new Date('2026-06-01T10:00:00Z')
    expect(parseStamp('2026-06-01T10:00:00Z')?.time).toBe(`${String(local.getHours()).padStart(2, '0')}:00`)
  })
  it('decides the slash order from the file', () => {
    expect(slashIsDayFirst(['01/02/2026', '25/02/2026'])).toBe(true)
    expect(slashIsDayFirst(['01/02/2026', '02/25/2026'])).toBe(false)
    expect(slashIsDayFirst(['01/02/2026'])).toBe(false)
  })
  it('reads durations and numbers', () => {
    expect(parseDuration('1h 5m')).toBe(3900)
    expect(parseDuration('45m')).toBe(2700)
    expect(parseDuration('90s')).toBe(90)
    expect(parseDuration('0:20:00')).toBe(1200)
    expect(parseDuration('2:30')).toBe(150)
    expect(parseDuration('75')).toBe(75)
    expect(parseDuration('')).toBeUndefined()
    expect(parseNumber('62,5')).toBe(62.5)
    expect(parseNumber('1,000.5')).toBe(1000.5)
    expect(parseNumber('-3')).toBeUndefined()
    expect(parseNumber('abc')).toBeUndefined()
  })
  it('matches headers whatever their case and punctuation', () => {
    expect(headerKey('Weight (kgs)')).toBe('weightkgs')
    expect(headerKey('WEIGHT_KGS')).toBe('weightkgs')
    expect(detectFormat(['DATE', 'exercise-name', 'WEIGHT'])).toBe('generic')
    expect(detectFormat(['Date', 'Exercise', 'Category', 'Weight (kgs)', 'Reps', 'Comment'])).toBe('fitnotes')
    expect(detectFormat(['Date', 'Workout Name', 'Exercise Name', 'Set Order', 'Weight (kg)', 'Reps'])).toBe('strong')
    expect(detectFormat(['foo', 'bar'])).toBeNull()
    expect(detectFormat(['date', 'exercise'])).toBeNull()
  })
})

describe('exercise names', () => {
  it('strips a trailing equipment bracket only', () => {
    expect(cleanName('Bench Press (Barbell)')).toEqual({ base: 'Bench Press', equipment: 'barbell', query: 'barbell Bench Press' })
    expect(cleanName('Pull Up (Bodyweight)')).toEqual({ base: 'Pull Up', equipment: 'bodyweight', query: 'Pull Up' })
    expect(cleanName('Curl (EZ Bar)').equipment).toBe('ez bar')
    expect(cleanName('Row (Wide Grip)')).toEqual({ base: 'Row (Wide Grip)', query: 'Row (Wide Grip)' })
    expect(cleanName('  Plank ')).toEqual({ base: 'Plank', query: 'Plank' })
  })
  it('every alias points at a real exercise', () => {
    const ids = new Set(CATALOGUE.map(e => e.id))
    for (const [name, id] of NAME_ALIASES) expect(ids.has(id), `${name} -> ${id}`).toBe(true)
  })
  it('maps common names with confidence, odd ones to review, nonsense to none', async () => {
    const [bench, squat, exact, odd, none] = await matchNames(
      ['Bench Press (Barbell)', 'Squat (Barbell)', 'Barbell Squat', 'Chest Press (Machine)', 'Zzqx Wibble'], [],
    )
    expect(bench).toMatchObject({ exId: 'Barbell_Bench_Press_-_Medium_Grip', confidence: 'high', equipment: 'barbell' })
    expect(squat).toMatchObject({ exId: 'Barbell_Squat', confidence: 'high' })
    expect(exact).toMatchObject({ exId: 'Barbell_Squat', confidence: 'high' })
    expect(odd.exId).toBeTruthy()
    expect(none).toEqual({ name: 'Zzqx Wibble', confidence: 'none' })
  })
  it('a partial match goes to review', async () => {
    const [m] = await matchNames(['Barbell Squat Variation Special'], [])
    expect(m.confidence).not.toBe('high')
  })
  it('reuses an existing custom exercise of the same name', async () => {
    const [m] = await matchNames(['Tire Flip Deluxe'], [{ id: 'custom-x', name: 'tire flip deluxe', bodyPart: 'other', equipment: 'other', primary: [], secondary: [], category: 'strength' }])
    expect(m).toMatchObject({ exId: 'custom-x', confidence: 'high' })
  })
})

describe('strong', () => {
  it('asks for the unit, skips rest timers and groups workouts', async () => {
    const { file, built } = await run(strongCsv, undefined, { unit: 'kg' })
    expect(file.format).toBe('strong')
    expect(file.needsUnit).toBe(true)
    expect(file.skipped).toBe(1)
    expect(built.workouts.map(w => [w.date, w.name])).toEqual([['2026-03-02', 'Push Day'], ['2026-03-04', 'Legs'], ['2026-03-06', 'Cardio']])
    expect(built.from).toBe('2026-03-02')
    expect(built.to).toBe('2026-03-06')
  })
  it('reads set markers, notes, length and drops', async () => {
    const { built } = await run(strongCsv, undefined, { unit: 'kg' })
    const [push, legs, cardio] = built.workouts
    expect(push.end - push.start).toBe(3900_000)
    expect(push.note).toBe('Felt good')
    const bench = entryOf(push, 'Barbell_Bench_Press_-_Medium_Grip')
    expect(bench.note).toBe('Paused, slow')
    expect(bench.sets).toEqual([
      { w: 135, r: 10, done: true, warmup: true },
      { w: 185, r: 8, done: true, rpe: 8 },
      { w: 185, r: 7, done: true, rpe: 9 },
    ])
    expect(entryOf(push, 'Plank').sets).toEqual([{ sec: 60, done: true }])
    const squat = entryOf(legs, 'Barbell_Squat')
    expect(squat.sets).toHaveLength(2)
    expect(squat.sets[1].drops).toEqual([{ w: 135, r: 8 }])
    expect(entryOf(cardio, 'Running_Treadmill').sets[0]).toMatchObject({ min: 30, speed: 10 })
  })
  it('makes unmatched names custom, safely without a primary muscle', async () => {
    const { built, profile } = await run(strongCsv, undefined, { unit: 'kg' })
    expect(built.customEx).toHaveLength(1)
    expect(built.customEx[0]).toMatchObject({ name: 'Tire Flip Deluxe', bodyPart: 'other', primary: [], secondary: [], category: 'strength' })
    expect(profile.customEx).toHaveLength(1)
    expect(built.workouts[1].entries.some(e => e.exId === built.customEx[0].id)).toBe(true)
  })
})

describe('hevy', () => {
  it('reads its columns, dates, kinds and length', async () => {
    const { file, built } = await run(hevyCsv)
    expect(file.format).toBe('hevy')
    expect(file.needsUnit).toBe(false)
    const [morning, upper] = built.workouts
    expect(morning.name).toBe('Run')
    expect(upper.date).toBe('2026-11-02')
    expect(upper.end - upper.start).toBe(70 * 60_000)
    expect(upper.note).toBe('Morning session')
    const bench = entryOf(upper, 'Barbell_Bench_Press_-_Medium_Grip')
    expect(bench.note).toBe('Elbows in')
    expect(bench.sets[0].warmup).toBe(true)
    expect(bench.sets[1].rpe).toBe(8.5)
    expect(bench.sets[2].failure).toBe(true)
    const lat = entryOf(upper, 'Wide-Grip_Lat_Pulldown')
    expect(lat.sg).toBe('0')
    expect(lat.sets[0].drops).toEqual([{ w: 40, r: 12 }])
    expect(entryOf(upper, 'Plank').sets[0].sec).toBe(75)
  })
  it('takes weight_lbs as pounds', async () => {
    const text = 'title,start_time,exercise_title,set_type,weight_lbs,reps\nA,"2 Nov 2026, 09:30",Squat (Barbell),normal,225,5\n'
    const { built } = await run(text)
    expect(built.workouts[0].entries[0].sets[0].w).toBe(102)
  })
})

describe('fitnotes', () => {
  it('reads row units, time and comments, and groups by date', async () => {
    const { file, built } = await run(fitnotesCsv)
    expect(file.format).toBe('fitnotes')
    expect(file.needsUnit).toBe(false)
    expect(built.workouts.map(w => w.date)).toEqual(['2026-05-11', '2026-05-13'])
    expect(built.workouts[0].name).toBe('Imported')
    const [lift, tread] = built.workouts[0].entries
    expect(lift.sets.map(s => s.w)).toEqual([45.25, 60])
    expect(lift.note).toBe('Easy')
    expect(tread.sets[0]).toMatchObject({ min: 20, speed: 9 })
    expect(built.workouts[1].entries[0].sets[0].sec).toBe(90)
  })
  it('understands the older Weight (kgs) column', async () => {
    const text = 'Date,Exercise,Category,Weight (kgs),Reps,Comment\n2026-01-01,Plank,Abs,10,5,\n'
    const { file, built } = await run(text)
    expect(file.needsUnit).toBe(false)
    expect(built.workouts[0].entries[0].sets[0].w).toBe(10)
  })
})

describe('formats seen in real exports', () => {
  it('strong 2018: rows wrapped in quotes, lbs and mi. as column names', async () => {
    const { file, built } = await run(strong2018Csv)
    expect(file.format).toBe('strong')
    expect(file.needsUnit).toBe(false)
    expect(file.rows).toHaveLength(5)
    const [a, b] = built.workouts
    expect(a.name).toBe('A')
    expect(entryOf(a, 'Barbell_Squat').sets.map(s => s.w)).toEqual([43, 47.75])
    expect(entryOf(a, 'Pullups').sets).toEqual([{ r: 6, done: true }])
    expect(entryOf(a, 'Running_Treadmill').sets[0]).toMatchObject({ min: 10, km: 2.41 })
    expect(b.note).toBe('Short one')
    expect(entryOf(b, 'Dumbbell_Bench_Press').note).toBe('Slow')
  })
  it('strong 2019: semicolons, unit columns and "mi."', async () => {
    const { file, built } = await run(strong2019Csv)
    expect(file.needsUnit).toBe(false)
    const [bike, lift] = built.workouts
    expect(entryOf(bike, 'Bicycling_Stationary').sets[0]).toMatchObject({ min: 30, km: 9.66 })
    expect(entryOf(lift, 'Barbell_Deadlift').sets.map(s => s.w)).toEqual([84, 93])
  })
  it('strong 2025: rest timers, reps as 10.0, a timer left running for days', async () => {
    const { file, built } = await run(strong2025Csv, undefined, { unit: 'kg' })
    expect(file.skipped).toBe(2)
    const [evening, morning] = built.workouts
    expect(evening.end - evening.start).toBe(0)
    expect(entryOf(evening, 'Incline_Dumbbell_Press').sets.map(s => s.r)).toEqual([10, 8])
    expect(morning.end - morning.start).toBe(58 * 60_000)
    expect(entryOf(morning, 'Butterfly').sets[0].rpe).toBe(8)
    expect(entryOf(morning, 'Standing_Military_Press').sets).toHaveLength(1)
  })
  it('hevy US locale: 12-hour times, lbs and miles, start equal to end', async () => {
    const { file, matches, built } = await run(hevyUsCsv)
    expect(file.needsUnit).toBe(false)
    expect(matches.every(m => m.confidence === 'high')).toBe(true)
    const [evening, late] = built.workouts
    expect(evening.name).toBe('Evening workout \u{1F3CB}\u{FE0F}')
    expect(evening.end - evening.start).toBe(88 * 60_000)
    expect(new Date(evening.start).getHours()).toBe(20)
    expect(entryOf(evening, 'Bodyweight_Squat').sets).toEqual([{ r: 15, done: true }])
    expect(entryOf(evening, 'Leverage_Chest_Press').sets[0]).toMatchObject({ w: 40.75, r: 12, rpe: 8.5 })
    expect(entryOf(evening, 'Seated_Cable_Rows').sg).toBe('0')
    expect(entryOf(evening, 'Elliptical_Trainer').sets[0]).toMatchObject({ min: 5, km: 1.61 })
    expect(new Date(late.start).getHours()).toBe(0)
    expect(late.end).toBe(late.start)
    expect(late.entries[0].exId).toBe('Preacher_Curl')
  })
  it('hevy unquoted: dropset, a weighted lunge over a distance, a timed hang', async () => {
    const { built } = await run(hevyPlainCsv)
    const [w] = built.workouts
    expect(w.name).toBe('Legs & Back')
    expect(entryOf(w, 'Hammer_Curls').sets).toEqual([
      { w: 10, r: 16, done: true, warmup: true },
      { w: 15, r: 12, done: true, failure: true, drops: [{ w: 10, r: 8 }] },
    ])
    const lunge = w.entries[1]
    expect(lunge.sets).toEqual([{ w: 12, r: 0, done: true }])
    expect(lunge.note).toBe('0.02 km')
    expect(w.entries[2].sets).toEqual([{ sec: 45, done: true }])
  })
  it('fitnotes: unquoted comment with commas, default names, 0.0 kgs, a non-Latin name', async () => {
    const { file, matches, built } = await run(fitnotesRealCsv)
    expect(file.format).toBe('fitnotes')
    expect(file.bad).toBe(0)
    const [mon, wed] = built.workouts
    const bench = entryOf(mon, 'Barbell_Bench_Press_-_Medium_Grip')
    expect(bench.sets.map(s => s.w)).toEqual([60, 62.5])
    expect(bench.note).toBe('Felt ok, 7,5/10')
    expect(entryOf(mon, 'Incline_Dumbbell_Press').sets).toHaveLength(1)
    expect(entryOf(mon, 'Dumbbell_Bicep_Curl').sets).toHaveLength(1)
    expect(entryOf(mon, 'Plank').sets).toEqual([{ sec: 60, done: true }])
    expect(entryOf(wed, 'Pushups').sets).toEqual([{ r: 15, done: true }])
    expect(entryOf(wed, 'Running_Treadmill').sets[0]).toMatchObject({ min: 20, km: 3.22 })
    const hebrew = '\u05dc\u05d7\u05d9\u05e6\u05d4'
    expect(matches.find(m => m.name === hebrew)?.confidence).toBe('none')
    expect(built.customEx.map(c => c.name)).toEqual([hebrew])
  })
})

describe('generic', () => {
  it('matches loose headers, semicolons, comma decimals and row units; counts bad rows', async () => {
    const { file, built } = await run(genericCsv)
    expect(file.format).toBe('generic')
    expect(file.bad).toBe(2)
    expect(file.skipped).toBe(1)
    expect(built.workouts).toHaveLength(1)
    const sets = built.workouts[0].entries[0].sets
    expect(sets.map(s => s.w)).toEqual([62.5, 61.25])
    expect(sets[0].rpe).toBe(8)
    expect(built.workouts[0].entries[0].note).toBe('a;b')
  })
  it('a duration with no reps or weight is the length of the set', async () => {
    const { built } = await run('date,exercise,duration\n2026-01-01,Plank,90\n')
    expect(built.workouts[0].entries[0].sets[0].sec).toBe(90)
  })
  it('a duration next to reps is the length of the workout', async () => {
    const { built } = await run('date,exercise,reps,duration\n2026-01-01,Plank,5,45\n2026-01-02,Plank,5,3600\n')
    expect(built.workouts.map(w => w.end - w.start)).toEqual([45 * 60_000, 3600_000])
  })
  it('refuses a file without the needed columns', async () => {
    expect(await parseImport('foo,bar\n1,2\n')).toBeNull()
    expect(await parseImport('')).toBeNull()
  })
})

describe('import rules', () => {
  it('converts into the current unit, rounded to its grid', async () => {
    const lb = emptyProfile(1, 'en')
    lb.settings.unit = 'lb'
    const { built } = await run(hevyCsv, lb)
    expect(entryOf(built.workouts[1], 'Barbell_Bench_Press_-_Medium_Grip').sets[1].w).toBe(176.5)
    const kg = await run(strongCsv, undefined, { unit: 'lb' })
    expect(entryOf(kg.built.workouts[0], 'Barbell_Bench_Press_-_Medium_Grip').sets[1].w).toBe(84)
    const same = await run(strongCsv, lb, { unit: 'lb' })
    expect(entryOf(same.built.workouts[0], 'Barbell_Bench_Press_-_Medium_Grip').sets[1].w).toBe(185)
  })
  it('a second import of the same file adds nothing', async () => {
    const first = await run(hevyCsv)
    const second = await run(hevyCsv, first.profile)
    expect(second.built.workouts).toEqual([])
    expect(second.built.skippedDays).toEqual(['2026-10-31', '2026-11-02'])
    expect(second.built.customEx).toEqual([])
    expect(second.profile).toBe(first.profile)
  })
  it('skips only the days already logged', async () => {
    const p = emptyProfile(1, 'en')
    p.workouts = [{ id: 'old', date: '2026-03-04', start: 1, end: 1, routineIds: [], name: 'Mine', entries: [], prs: [], vol: 0, updatedAt: 1 }]
    const { built } = await run(strongCsv, p, { unit: 'kg' })
    expect(built.skippedDays).toEqual(['2026-03-04'])
    expect(built.workouts.map(w => w.date)).toEqual(['2026-03-02', '2026-03-06'])
    expect(built.customEx).toEqual([])
    expect(built.names.has('Tire Flip Deluxe')).toBe(false)
  })
  it('follows the choices made in review', async () => {
    const l = await load(strongCsv)
    const choices = { ...l.choices, 'Bench Press (Barbell)': NEW_EXERCISE, 'Tire Flip Deluxe': 'Plank' }
    const built = buildImport(l.file, emptyProfile(1, 'en'), { ...l, choices, unit: 'kg', defaultName: 'x', makeId: makeIds() })
    expect(built.customEx.map(c => [c.name, c.equipment])).toEqual([['Bench Press (Barbell)', 'barbell']])
    expect(built.workouts[1].entries.some(e => e.exId === 'Plank')).toBe(true)
  })
  it('recomputes volume and records, including later workouts already there', async () => {
    const p = emptyProfile(1, 'en')
    const benchId = 'Barbell_Bench_Press_-_Medium_Grip'
    const start = new Date(2026, 10, 3, 12).getTime()
    p.workouts = [{
      id: 'later', date: '2026-11-03', start, end: start, routineIds: [], name: 'Later',
      entries: [{ exId: benchId, sets: [{ w: 100, r: 5, done: true }] }], prs: [], vol: 500, updatedAt: 1,
    }]
    const { profile } = await run(hevyCsv, p)
    const upper = profile.workouts.find(w => w.name === 'Upper A')!
    expect(upper.vol).toBe(80 * 8 + 80 * 6 + 60 * 10 + 40 * 12)
    const later = profile.workouts.find(w => w.id === 'later')!
    expect(later.prs).toEqual(detectRecords(later.entries, [upper]).prs)
    expect(later.prs).toEqual([benchId])
    expect(profile.exWeights[benchId].w).toBe(100)
  })
})

describe('csv export', () => {
  const p = emptyProfile(1, 'en')
  p.settings.unit = 'lb'
  p.customEx = [{ id: 'c1', name: '=Evil, "move"', bodyPart: 'other', equipment: 'other', primary: [], secondary: [], category: 'strength' }]
  const start = new Date(2026, 0, 5, 9, 7).getTime()
  p.workouts = [{
    id: 'w', date: '2026-01-05', start, end: start, routineIds: [], name: 'A', note: 'Top', vol: 1, prs: [], updatedAt: 1,
    entries: [
      { exId: 'Plank', note: 'Mid', sets: [{ sec: 30, done: true }, { done: false, sec: 9 }] },
      { exId: 'c1', sets: [{ w: 100, r: 5, done: true, warmup: true }, { w: 200, r: 3, rpe: 9, done: true, drops: [{ w: 150, r: 4 }] }] },
    ],
  }]
  p.bodyweight = [{ date: '2026-01-05', w: 180, t: 1 }]
  p.measurements = [{ date: '2026-01-06', t: 1, values: { waist: 81.28, '+custom': 10 } }]

  it('sets.csv has the agreed columns, one row per set and drop', () => {
    const text = setsCsv(p)
    expect(text.startsWith('﻿date,start_time,workout,exercise_id,exercise_name,set_number,set_type,weight,unit,reps,seconds,minutes,speed,incline,km,rir,rpe,note\r\n')).toBe(true)
    const rows = parseCsv(text)
    expect(rows).toHaveLength(5)
    expect(rows[1]).toEqual(['2026-01-05', '09:07', 'A', 'Plank', 'Plank', '1', 'normal', '', '', '', '30', '', '', '', '', '', '', 'Top | Mid'])
    expect(rows[2].slice(4, 10)).toEqual(['\'=Evil, "move"', '1', 'warmup', '100', 'lb', '5'])
    expect(rows[3][16]).toBe('9')
    expect(rows[4].slice(5, 10)).toEqual(['2', 'drop', '150', 'lb', '4'])
  })
  it('body.csv joins weights and measurements in the current scale', () => {
    const rows = parseCsv(bodyCsv(p))
    expect(rows[0].slice(0, 4)).toEqual(['date', 'weight', 'unit', 'waist_in'])
    expect(rows[0].at(-1)).toBe("'+custom_in")
    expect(rows[1].slice(0, 3)).toEqual(['2026-01-05', '180', 'lb'])
    expect(rows[2].slice(0, 4)).toEqual(['2026-01-06', '', '', '32'])
  })
})

describe('backup', () => {
  const full = (): Profile => {
    const p = emptyProfile(1, 'ru')
    p.settings.unit = 'lb'
    p.settings.oneRmFormula = 'wathan'
    p.targetW = 170
    p.workouts = [
      { id: 'b', date: '2026-02-01', start: 20, end: 30, routineIds: [], name: 'B', entries: [{ exId: 'Plank', sets: [{ sec: 30, done: true }] }], prs: [], vol: 0, updatedAt: 1 },
      { id: 'a', date: '2026-01-01', start: 10, end: 15, routineIds: ['r'], name: 'A', entries: [], prs: ['x'], vol: 3, note: 'n', updatedAt: 1 },
    ]
    p.routines = [{ id: 'r', name: 'R', ex: [{ exId: 'Plank', sets: 3, reps: 5, weight: 0 }], updatedAt: 1 }]
    p.bodyweight = [{ date: '2026-01-01', w: 180, t: 1 }]
    p.measurements = [{ date: '2026-01-01', t: 1, values: { waist: 80 } }]
    p.customEx = [{ id: 'c', name: 'C', bodyPart: 'other', equipment: 'other', primary: [], secondary: [], category: 'strength' }]
    p.favEx = ['c']
    p.week = { 1: ['r'] }
    return p
  }
  const text = (o: unknown) => JSON.stringify(o)

  it('round-trips a full profile', () => {
    const p = full()
    expect(parseBackup(text(buildBackup(p, 1000)))).toEqual({ ok: true, profile: p, exportedAt: new Date(1000).toISOString() })
  })
  it('summarises what would come in', () => {
    expect(backupSummary(full())).toEqual({ workouts: 2, routines: 1, weighIns: 1, from: '2026-01-01', to: '2026-02-01' })
  })
  it('rejects garbage, another kind, another version and a broken shape', () => {
    const fail = (t: string) => {
      const r = parseBackup(t)
      return r.ok ? 'ok' : r.error
    }
    const ok = buildBackup(full())
    expect(fail('nope')).toBe('json')
    expect(fail('[]')).toBe('kind')
    expect(fail(text({ ...ok, kind: 'gym-dtwin-plan' }))).toBe('kind')
    expect(fail(text({ ...ok, v: 2 }))).toBe('version')
    expect(fail(text({ kind: BACKUP_KIND, v: 1 }))).toBe('shape')
    expect(fail(text({ ...ok, profile: { ...ok.profile, workouts: 'x' } }))).toBe('shape')
    expect(fail(text({ ...ok, profile: { ...ok.profile, workouts: [{ id: 1 }] } }))).toBe('shape')
    expect(fail(text({ ...ok, profile: { ...ok.profile, routines: [{ id: 'r', name: 'R', ex: [{ exId: 'x' }] }] } }))).toBe('shape')
    expect(fail(text({ ...ok, profile: { ...ok.profile, bodyweight: [{ date: 'x', w: 1 }] } }))).toBe('shape')
    expect(fail(text({ ...ok, profile: { ...ok.profile, settings: null } }))).toBe('shape')
  })
  it('settings the app could not use go back to defaults; null lists become empty', () => {
    const ok = buildBackup(full())
    const bad = { ...ok.profile, bodyweight: null, settings: { ...ok.profile.settings, lang: 'xx', oneRmFormula: 'magic', accent: 'url(x)', restSec: 'lots', theme: 'neon' } }
    const r = parseBackup(text({ ...ok, profile: bad }))
    if (!r.ok) throw new Error(r.error)
    expect(r.profile.bodyweight).toEqual([])
    expect(['uz', 'ru', 'en']).toContain(r.profile.settings.lang)
    expect(r.profile.settings).toMatchObject({ oneRmFormula: 'epley', accent: '#c6f432', restSec: 90, theme: 'system', unit: 'lb' })
  })
  it('keeps and clears the pre-restore copy', () => {
    const m = new Map<string, string>()
    const kv = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
    const p = full()
    expect(stashPreRestore(kv, p)).toBe(true)
    expect(m.has(PRE_RESTORE_KEY)).toBe(true)
    expect(readPreRestore(kv)).toEqual(p)
    clearPreRestore(kv)
    expect(readPreRestore(kv)).toBeNull()
  })
  it('reports when the device has no room for the copy', () => {
    const kv = { getItem: () => null, setItem: () => { throw new Error('full') }, removeItem: () => {} }
    expect(stashPreRestore(kv, full())).toBe(false)
    expect(stashPreRestore(null, full())).toBe(false)
  })
})

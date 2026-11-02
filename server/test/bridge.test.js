import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { diaryChanges, dtwinBridge, dueWeekly, tick } from '../src/bridge.js'
import { openStore } from '../src/store.js'

// Sunday 2026-11-08, 20:05 in Tashkent (UTC+5).
const SUNDAY = Date.UTC(2026, 10, 8, 15, 5)
const MON_1805 = Date.UTC(2026, 10, 9, 13, 5)
const H = 3_600_000
const w = (id, date, over = {}) => ({ id, date, name: 'Oyoq', start: Date.parse(`${date}T10:00:00Z`), end: Date.parse(`${date}T10:00:00Z`) + H, vol: 3200.4, prs: [], ...over })
const notify = (over = {}) => ({ enabled: true, time: '18:00', days: [1], quietFrom: '22:00', quietTo: '08:00', tz: 'Asia/Tashkent', diary: true, ...over })

describe('diaryChanges', () => {
  it('sends recent finished workouts once, with only the short facts', () => {
    const doc = { notify: notify(), settings: { lang: 'en' }, workouts: [w('a', '2026-11-07', { entries: [{ secret: 1 }], note: 'private' }), w('old', '2026-09-01'), w('b', '2026-11-08', { name: '' })] }
    const first = diaryChanges(doc, new Map(), '2026-11-08')
    expect(first.deletes).toEqual([])
    expect(first.upserts.map(u => u.entry)).toEqual([
      { id: 'a', date: '2026-11-07', name: 'Oyoq', minutes: 60, volume: 3200 },
      { id: 'b', date: '2026-11-08', name: 'Workout', minutes: 60, volume: 3200 },
    ])
    const sent = new Map(first.upserts.map(u => [u.entry.id, u.hash]))
    expect(diaryChanges(doc, sent, '2026-11-08')).toEqual({ upserts: [], deletes: [] })
    const edited = { ...doc, workouts: [w('a', '2026-11-07', { name: 'Oyoq kuni' })] }
    const next = diaryChanges(edited, sent, '2026-11-08')
    expect(next.upserts.map(u => u.entry.name)).toEqual(['Oyoq kuni'])
    expect(next.deletes).toEqual(['b'])
  })

  it('withdrawing consent removes every entry and sends nothing', () => {
    const doc = { notify: notify({ diary: false }), workouts: [w('a', '2026-11-07')] }
    expect(diaryChanges(doc, new Map([['a', 'h'], ['gone', 'h']]), '2026-11-08')).toEqual({ upserts: [], deletes: ['a', 'gone'] })
    expect(diaryChanges({ workouts: [w('a', '2026-11-07')] }, new Map(), '2026-11-08')).toEqual({ upserts: [], deletes: [] })
  })

  it('skips malformed and future workouts and sends zero volume as null', () => {
    const doc = { notify: notify(), workouts: [w('x'.repeat(101), '2026-11-07'), w('f', '2026-11-09'), w('n', '2026-11-07', { end: 0 }), w('z', '2026-11-07', { vol: 0 })] }
    expect(diaryChanges(doc, new Map(), '2026-11-08').upserts.map(u => [u.entry.id, u.entry.volume])).toEqual([['z', null]])
  })
})

describe('dueWeekly', () => {
  const user = (over = {}, doc = {}) => ({ userId: 'u', doc: { notify: notify(), settings: { lang: 'uz' }, workouts: [w('a', '2026-11-03', { prs: ['bench'] }), w('b', '2026-11-08'), w('old', '2026-11-01')], ...doc }, ...over })
  it('sums the last seven local days on Sunday evening', () => {
    expect(dueWeekly([user()], SUNDAY)).toEqual([{ userId: 'u', key: '2026-11-08', text: "Hafta yakuni: 2 ta mashg'ulot, 120 daqiqa, 1 ta rekord. Yaxshi ish!" }])
  })
  it('respects the switch, other days, the window and quiet hours', () => {
    expect(dueWeekly([user({}, { notify: notify({ weekly: false }) })], SUNDAY)).toEqual([])
    expect(dueWeekly([user({}, { notify: notify({ enabled: false }) })], SUNDAY)).toEqual([])
    expect(dueWeekly([user()], MON_1805)).toEqual([])
    expect(dueWeekly([user()], SUNDAY + H)).toEqual([])
    expect(dueWeekly([user({}, { notify: notify({ quietFrom: '19:00', quietTo: '07:00' }) })], SUNDAY)).toEqual([])
  })
  it('has a message for an empty week', () => {
    expect(dueWeekly([user({}, { workouts: [], settings: { lang: 'en' } })], SUNDAY)[0].text).toContain('No workouts')
  })
})

describe('dtwinBridge', () => {
  const fake = status => {
    const calls = []
    return { calls, fetch: async (url, init) => { calls.push({ url, method: init.method, auth: init.headers.Authorization, body: init.body && JSON.parse(init.body) }); return new Response(status === 204 ? null : '{}', { status }) } }
  }
  it('maps dtwin answers', async () => {
    for (const [status, result] of [[200, 'sent'], [409, 'no_telegram'], [404, 'not_linked']]) {
      const f = fake(status)
      expect(await dtwinBridge({ baseUrl: 'http://d', serviceToken: 's', fetch: f.fetch }).notify('g', 'hi')).toBe(result)
      expect(f.calls[0]).toMatchObject({ url: 'http://d/internal/notify', method: 'POST', auth: 'Bearer s', body: { userId: 'g', text: 'hi' } })
    }
    await expect(dtwinBridge({ baseUrl: 'http://d', serviceToken: 's', fetch: fake(500).fetch }).notify('g', 'hi')).rejects.toThrow()
    const f = fake(204)
    await dtwinBridge({ baseUrl: 'http://d', serviceToken: 's', fetch: f.fetch }).diaryDelete('g', 'a/b')
    expect(f.calls[0].url).toBe('http://d/internal/diary/g/a%2Fb')
    await expect(dtwinBridge({ baseUrl: 'http://d', serviceToken: 's', fetch: fake(502).fetch }).diaryPut('g', {})).rejects.toThrow()
  })
})

describe('tick', () => {
  const dirs = []
  afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }) })
  const setup = () => {
    const d = mkdtempSync(join(tmpdir(), 'gym-bridge-'))
    dirs.push(d)
    return openStore(join(d, 'gym.sqlite'), () => MON_1805)
  }
  const fakeBridge = (fail = new Set()) => {
    const log = []
    return {
      log,
      notify: async (userId, text) => { if (fail.has('notify')) throw new Error('down'); log.push(['notify', userId, text]); return userId === 'nolink' ? 'no_telegram' : 'sent' },
      diaryPut: async (userId, e) => { if (fail.has('diary')) throw new Error('down'); log.push(['put', userId, e.id]) },
      diaryDelete: async (userId, id) => { log.push(['del', userId, id]) },
    }
  }
  const doc = (over = {}) => JSON.stringify({ settings: { lang: 'en' }, notify: notify(), workouts: [w('a', '2026-11-07')], updatedAt: 1, ...over })

  it('reminds once per day, syncs the diary once, and retries after a failure', async () => {
    const store = setup()
    store.put('u', 0, doc())
    store.put('nolink', 0, doc({ notify: notify({ diary: false }) }))
    store.put('trained', 0, doc({ workouts: [w('t', '2026-11-09')] }))
    const down = fakeBridge(new Set(['notify', 'diary']))
    const s0 = await tick({ store, bridge: down, now: MON_1805, log: () => {} })
    expect(s0.errors).toBeGreaterThan(0)

    const b = fakeBridge()
    await tick({ store, bridge: b, now: MON_1805, log: () => {} })
    expect(b.log.filter(x => x[0] === 'notify').map(x => x[1]).sort()).toEqual(['nolink', 'u'])
    expect(b.log.filter(x => x[0] === 'put')).toEqual([['put', 'u', 'a'], ['put', 'trained', 't']])

    const again = fakeBridge()
    await tick({ store, bridge: again, now: MON_1805 + 60_000, log: () => {} })
    expect(again.log).toEqual([])

    const row = store.get('u')
    store.put('u', row.rev, doc({ notify: notify({ diary: false }) }))
    const off = fakeBridge()
    await tick({ store, bridge: off, now: MON_1805 + 120_000, log: () => {} })
    expect(off.log).toEqual([['del', 'u', 'a']])

    store.forget('u')
    expect(store.diary.sent('u').size).toBe(0)
    expect(store.sent.has('u', 'remind', '2026-11-09')).toBe(false)
    store.close()
  })
})

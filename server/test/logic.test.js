import { describe, expect, it, vi } from 'vitest'
import { diaryEntry, dueReminders, inQuietHours, localClock, runReminders } from '../src/reminders.js'
import { cachedVerifier, introspectionVerifier, userinfoVerifier } from '../src/verifier.js'

// Monday 2026-11-02, 18:05 in Tashkent (UTC+5).
const NOW = Date.UTC(2026, 10, 2, 13, 5)
const prefs = (over = {}) => ({ enabled: true, time: '18:00', days: [1], quietFrom: '22:00', quietTo: '08:00', tz: 'Asia/Tashkent', ...over })
const user = (over = {}) => ({ userId: 'u', notify: prefs(), workouts: [], ...over })

describe('dueReminders', () => {
  it('reminds inside the window on a chosen day', () => {
    const [r] = dueReminders([user({ lang: 'en' })], NOW)
    expect(r).toMatchObject({ userId: 'u', date: '2026-11-02' })
    expect(r.text).toContain('training day')
  })

  it('falls back to uz text', () => {
    expect(dueReminders([user({ lang: 'xx' })], NOW)[0].text).toContain('mashg\'ulot')
  })

  it.each([
    ['turned off', { notify: prefs({ enabled: false }) }],
    ['no prefs', { notify: undefined }],
    ['another day', { notify: prefs({ days: [2, 3] }) }],
    ['before the time', { notify: prefs({ time: '18:06' }) }],
    ['window passed', { notify: prefs({ time: '17:50' }) }],
    ['bad time', { notify: prefs({ time: '25:99' }) }],
    ['unknown zone', { notify: prefs({ tz: 'Mars/Base' }) }],
    ['already reminded', { lastRemindedOn: '2026-11-02' }],
    ['trained today on another device', { workouts: [{ date: '2026-11-02' }] }],
    ['training right now', { active: { date: '2026-11-02' } }],
    ['quiet hours', { notify: prefs({ quietFrom: '18:00', quietTo: '19:00' }) }],
  ])('does not remind: %s', (_name, over) => {
    expect(dueReminders([user(over)], NOW)).toEqual([])
  })

  it('a workout yesterday does not stop today', () => {
    expect(dueReminders([user({ workouts: [{ date: '2026-11-01' }], lastRemindedOn: '2026-11-01' })], NOW)).toHaveLength(1)
  })

  it('judges "today" and the weekday in the user\'s zone, not UTC', () => {
    // 20:30 UTC on Monday is 01:30 Tuesday in Tashkent.
    const late = Date.UTC(2026, 10, 2, 20, 30)
    const u = user({ notify: prefs({ time: '01:30', days: [2], quietFrom: '00:00', quietTo: '00:00' }) })
    expect(dueReminders([u], late)[0].date).toBe('2026-11-03')
    expect(dueReminders([user({ notify: prefs({ time: '20:30', tz: 'UTC' }) })], late)).toHaveLength(1)
  })

  it('handles many users independently', () => {
    const list = [user({ userId: 'a' }), user({ userId: 'b', notify: prefs({ enabled: false }) }), user({ userId: 'c' })]
    expect(dueReminders(list, NOW).map(r => r.userId)).toEqual(['a', 'c'])
  })
})

describe('time helpers', () => {
  it('localClock reads the zone', () => {
    expect(localClock(NOW, 'Asia/Tashkent')).toEqual({ date: '2026-11-02', weekday: 1, minute: 18 * 60 + 5 })
    expect(localClock(NOW, 'nope')).toBeNull()
  })

  it('quiet hours, plain and past midnight', () => {
    expect(inQuietHours(60 * 23, '22:00', '08:00')).toBe(true)
    expect(inQuietHours(60 * 7, '22:00', '08:00')).toBe(true)
    expect(inQuietHours(60 * 8, '22:00', '08:00')).toBe(false)
    expect(inQuietHours(60 * 13, '12:00', '14:00')).toBe(true)
    expect(inQuietHours(60 * 14, '12:00', '14:00')).toBe(false)
    expect(inQuietHours(60, '10:00', '10:00')).toBe(false)
    expect(inQuietHours(60, undefined, '10:00')).toBe(false)
  })
})

describe('runReminders', () => {
  it('marks only what was delivered; one failure does not stop the rest', async () => {
    const marked = []
    const notifier = { send: vi.fn(async r => { if (r.userId === 'a') throw new Error('down') }) }
    const sent = await runReminders({
      users: [user({ userId: 'a' }), user({ userId: 'b' })],
      notifier,
      markSent: (id, date) => marked.push([id, date]),
      now: NOW,
    })
    expect(sent).toBe(1)
    expect(notifier.send).toHaveBeenCalledTimes(2)
    expect(marked).toEqual([['b', '2026-11-02']])
  })
})

describe('diaryEntry', () => {
  const w = { id: 'w', date: '2026-11-02', name: 'Push', start: 0, end: 3_600_000, vol: 5000, entries: [{ exId: 'x' }], note: 'private' }

  it('needs consent', () => {
    expect(diaryEntry(w, undefined)).toBeNull()
    expect(diaryEntry(w, { diary: false })).toBeNull()
  })

  it('holds the short facts and nothing else', () => {
    expect(diaryEntry(w, { diary: true })).toEqual({ id: 'w', date: '2026-11-02', name: 'Push', minutes: 60, volume: 5000 })
  })
})

describe('cachedVerifier', () => {
  it('asks once within 5 minutes, again after', async () => {
    let t = 0
    const inner = { verify: vi.fn(async () => ({ userId: 'u' })) }
    const v = cachedVerifier(inner, { now: () => t })
    await v.verify('a')
    t = 299_000
    await v.verify('a')
    expect(inner.verify).toHaveBeenCalledTimes(1)
    t = 301_000
    await v.verify('a')
    expect(inner.verify).toHaveBeenCalledTimes(2)
  })

  it('a rejected token is rechecked sooner', async () => {
    let t = 0
    const inner = { verify: vi.fn(async () => null) }
    const v = cachedVerifier(inner, { now: () => t })
    await v.verify('a')
    await v.verify('a')
    expect(inner.verify).toHaveBeenCalledTimes(1)
    t = 31_000
    await v.verify('a')
    expect(inner.verify).toHaveBeenCalledTimes(2)
  })

  it('a failed check is not cached', async () => {
    const inner = { verify: vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue({ userId: 'u' }) }
    const v = cachedVerifier(inner)
    await expect(v.verify('a')).rejects.toThrow()
    expect(await v.verify('a')).toEqual({ userId: 'u' })
  })

  it('the cache has a size limit', async () => {
    const inner = { verify: vi.fn(async () => ({ userId: 'u' })) }
    const v = cachedVerifier(inner, { maxEntries: 2 })
    await v.verify('a')
    await v.verify('b')
    await v.verify('c')
    await v.verify('a')
    expect(inner.verify).toHaveBeenCalledTimes(4)
  })
})

describe('introspectionVerifier', () => {
  const reply = body => vi.fn(async () => new Response(JSON.stringify(body)))
  const make = send => introspectionVerifier({ url: 'https://id.test/oauth/introspect', serviceToken: 'svc', scope: 'gym', clientId: 'gym-dtwin', fetch: send })
  const good = { active: true, sub: 'u1', scope: 'read gym', client_id: 'gym-dtwin' }

  it('accepts an active token of our client with the scope', async () => {
    const send = reply(good)
    expect(await make(send).verify('tok')).toEqual({ userId: 'u1' })
    const [, init] = send.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer svc')
    expect(String(init.body)).toBe('token=tok')
  })

  it.each([
    ['inactive', { ...good, active: false }],
    ['no subject', { ...good, sub: undefined }],
    ['another client', { ...good, client_id: 'claude' }],
    ['no scope', { ...good, scope: 'read' }],
    ['similar scope', { ...good, scope: 'gymnastics' }],
  ])('refuses: %s', async (_n, body) => {
    expect(await make(reply(body)).verify('tok')).toBeNull()
  })

  it('throws when dtwin fails', async () => {
    await expect(make(vi.fn(async () => new Response('', { status: 500 }))).verify('tok')).rejects.toThrow()
  })
})

describe('userinfoVerifier', () => {
  const make = send => userinfoVerifier({ url: 'https://id.test/me', fetch: send })

  it('reads the id', async () => {
    expect(await make(vi.fn(async () => new Response('{"id":"u2"}'))).verify('t')).toEqual({ userId: 'u2' })
    expect(await make(vi.fn(async () => new Response('{"sub":"u3"}'))).verify('t')).toEqual({ userId: 'u3' })
  })

  it('401 is an answer, 500 is a failure', async () => {
    expect(await make(vi.fn(async () => new Response('', { status: 401 }))).verify('t')).toBeNull()
    await expect(make(vi.fn(async () => new Response('', { status: 500 }))).verify('t')).rejects.toThrow()
  })
})

describe('cachedVerifier.forget', () => {
  it('drops cached answers for one user only', async () => {
    let calls = 0
    const v = cachedVerifier({ async verify(t) { calls++; return { userId: t.split(':')[0] } } })
    await v.verify('a:1'); await v.verify('b:1'); await v.verify('a:1')
    expect(calls).toBe(2)
    v.forget('a')
    await v.verify('a:1'); await v.verify('b:1')
    expect(calls).toBe(3)
  })

  it('accepts a numeric sub from introspection', async () => {
    const fetch = async () => new Response(JSON.stringify({ active: true, sub: 42, scope: 'gym', client_id: 'gym-dtwin' }))
    const v = introspectionVerifier({ url: 'x', serviceToken: 's', scope: 'gym', clientId: 'gym-dtwin', fetch })
    expect(await v.verify('t')).toEqual({ userId: '42' })
  })
})

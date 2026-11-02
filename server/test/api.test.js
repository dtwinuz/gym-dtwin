import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHandler } from '../src/app.js'
import { openStore } from '../src/store.js'
import { PROFILE_KIND } from '../src/validate.js'

const TOKENS = { 'tok-a': { userId: 'user-a' }, 'tok-b': { userId: 'user-b' } }
const fakeVerifier = {
  async verify(token) {
    if (token === 'boom') throw new Error('dtwin is down')
    return TOKENS[token] ?? null
  },
}

const profile = (over = {}) => ({ settings: { theme: 'dark' }, workouts: [], routines: [], updatedAt: 1, ...over })

let dir, store, server, url, logs

async function start(options = {}) {
  logs = []
  const handler = createHandler({ store, verifier: fakeVerifier, log: e => logs.push(JSON.stringify(e)), ...options })
  server = createServer((req, res) => void handler(req, res))
  await new Promise(res => server.listen(0, '127.0.0.1', res))
  url = `http://127.0.0.1:${server.address().port}`
}

const call = (method, { token = 'tok-a', body, raw, type = 'application/json', path = '/api/data', headers = {} } = {}) => fetch(url + path, {
  method,
  headers: {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(body !== undefined || raw !== undefined ? { 'Content-Type': type } : {}),
    ...headers,
  },
  body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
})

const put = (baseRev, p = profile(), opts = {}) => call('PUT', { body: { kind: PROFILE_KIND, baseRev, profile: p }, ...opts })

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'gym-api-'))
  store = openStore(join(dir, 'test.sqlite'))
})

afterEach(async () => {
  server.closeAllConnections()
  await new Promise(res => server.close(res))
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('auth', () => {
  it('401 with no token, a malformed header or an unknown token', async () => {
    await start()
    for (const opts of [{ token: null }, { token: 'nope' }, { token: null, headers: { Authorization: 'Basic abc' } }]) {
      const res = await call('GET', opts)
      expect(res.status).toBe(401)
      expect(res.headers.get('www-authenticate')).toBe('Bearer')
      expect(await res.json()).toEqual({ error: 'unauthorized' })
    }
  })

  it('503, not 401, when the check itself fails, so the client stays signed in', async () => {
    await start()
    const res = await call('GET', { token: 'boom' })
    expect(res.status).toBe(503)
    expect(await res.text()).not.toContain('dtwin is down')
  })
})

describe('GET and PUT', () => {
  it('404 with no document, then create, read and update by revision', async () => {
    await start()
    const none = await call('GET')
    expect(none.status).toBe(404)
    const { owner } = await none.json()
    expect(owner).toMatch(/^[0-9a-f]{16}$/)

    const created = await put(0, profile({ updatedAt: 7 }))
    expect(created.status).toBe(200)
    const { rev } = await created.json()
    expect(rev).toBeGreaterThan(0)

    const read = await call('GET')
    expect(read.status).toBe(200)
    expect(read.headers.get('cache-control')).toBe('no-store')
    const body = await read.json()
    expect(body).toMatchObject({ kind: PROFILE_KIND, rev, owner })
    expect(body.profile.updatedAt).toBe(7)

    const updated = await put(rev, profile({ updatedAt: 8 }))
    expect(updated.status).toBe(200)
    expect((await updated.json()).rev).toBe(rev + 1)
  })

  it('409 with the current state on a stale revision', async () => {
    await start()
    const { rev } = await (await put(0, profile({ updatedAt: 1 }))).json()
    await put(rev, profile({ updatedAt: 2 }))
    const stale = await put(rev, profile({ updatedAt: 3 }))
    expect(stale.status).toBe(409)
    const body = await stale.json()
    expect(body.rev).toBe(rev + 1)
    expect(body.profile.updatedAt).toBe(2)
  })

  it('409 when creating over an existing document', async () => {
    await start()
    await put(0)
    expect((await put(0)).status).toBe(409)
  })

  it('409 with no profile when writing to a deleted document', async () => {
    await start()
    const { rev } = await (await put(0)).json()
    await call('DELETE')
    const res = await put(rev)
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ rev: 0, profile: null })
  })

  it('a revision from before a deletion cannot match the new document', async () => {
    let clock = 1000
    store.close()
    store = openStore(join(dir, 'test.sqlite'), () => clock++)
    await start()
    const { rev } = await (await put(0)).json()
    await call('DELETE')
    await put(0)
    expect((await put(rev)).status).toBe(409)
  })

  it('users are isolated', async () => {
    await start()
    await put(0, profile({ updatedAt: 5 }))
    expect((await call('GET', { token: 'tok-b' })).status).toBe(404)
    await call('DELETE', { token: 'tok-b' })
    expect((await call('GET')).status).toBe(200)
  })

  it('concurrent writes on one revision: exactly one wins', async () => {
    await start()
    const { rev } = await (await put(0)).json()
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => put(rev, profile({ updatedAt: 100 + i }))))
    const codes = results.map(r => r.status).sort()
    expect(codes.filter(c => c === 200)).toHaveLength(1)
    expect(codes.filter(c => c === 409)).toHaveLength(7)
    const winner = await Promise.all(results.map(r => r.json()))
    expect(winner.find(x => x.rev && !x.profile).rev).toBe(rev + 1)
  })

  it('concurrent creates: exactly one wins', async () => {
    await start()
    const codes = (await Promise.all(Array.from({ length: 6 }, () => put(0)))).map(r => r.status)
    expect(codes.filter(c => c === 200)).toHaveLength(1)
  })

  it('two processes on one file cannot both win (the row is the lock)', async () => {
    await start()
    const other = openStore(join(dir, 'test.sqlite'))
    const made = store.put('u', 0, '{}')
    const one = store.put('u', made.rev, '{"a":1}')
    const two = other.put('u', made.rev, '{"a":2}')
    expect([one.ok, two.ok]).toEqual([true, false])
    expect(two.current.doc).toBe('{"a":1}')
    other.close()
  })

  it('DELETE removes the document and repeats harmlessly', async () => {
    await start()
    await put(0)
    expect((await call('DELETE')).status).toBe(204)
    expect((await call('DELETE')).status).toBe(204)
    expect((await call('GET')).status).toBe(404)
  })
})

describe('validation', () => {
  it.each([
    ['not json', { raw: '{nope' }, 'bad_json'],
    ['array', { body: [] }, 'bad_shape'],
    ['wrong kind', { body: { kind: 'other', baseRev: 0, profile: profile() } }, 'bad_shape'],
    ['no kind', { body: { baseRev: 0, profile: profile() } }, 'bad_shape'],
    ['negative rev', { body: { kind: PROFILE_KIND, baseRev: -1, profile: profile() } }, 'bad_shape'],
    ['fractional rev', { body: { kind: PROFILE_KIND, baseRev: 1.5, profile: profile() } }, 'bad_shape'],
    ['string rev', { body: { kind: PROFILE_KIND, baseRev: '1', profile: profile() } }, 'bad_shape'],
    ['no profile', { body: { kind: PROFILE_KIND, baseRev: 0 } }, 'bad_shape'],
    ['no settings', { body: { kind: PROFILE_KIND, baseRev: 0, profile: { updatedAt: 1 } } }, 'bad_shape'],
    ['no clock', { body: { kind: PROFILE_KIND, baseRev: 0, profile: { settings: {} } } }, 'bad_shape'],
    ['list not array', { body: { kind: PROFILE_KIND, baseRev: 0, profile: profile({ workouts: {} }) } }, 'bad_shape'],
    ['item without id', { body: { kind: PROFILE_KIND, baseRev: 0, profile: profile({ workouts: [{}] }) } }, 'bad_shape'],
    ['huge id', { body: { kind: PROFILE_KIND, baseRev: 0, profile: profile({ routines: [{ id: 'x'.repeat(201) }] }) } }, 'bad_shape'],
    ['dictionary not object', { body: { kind: PROFILE_KIND, baseRev: 0, profile: profile({ dayPlan: [] }) } }, 'bad_shape'],
    ['photos field', { body: { kind: PROFILE_KIND, baseRev: 0, profile: profile({ photos: [] }) } }, 'bad_shape'],
  ])('400 for %s', async (_name, opts, code) => {
    await start()
    const res = await call('PUT', opts)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: code })
    expect(store.get('user-a')).toBeNull()
  })

  it('415 unless the body is JSON', async () => {
    await start()
    expect((await call('PUT', { raw: '{}', type: 'text/plain' })).status).toBe(415)
  })
})

describe('limits', () => {
  it('413 by Content-Length', async () => {
    await start({ maxBody: 1000 })
    const res = await put(0, profile({ note: 'x'.repeat(2000) }))
    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ error: 'too_large' })
    expect(store.get('user-a')).toBeNull()
  })

  it('413 when a chunked body runs over', async () => {
    await start({ maxBody: 1000 })
    const chunk = new TextEncoder().encode('x'.repeat(600))
    const body = new ReadableStream({
      start(c) {
        c.enqueue(chunk)
        c.enqueue(chunk)
        c.close()
      },
    })
    const res = await fetch(`${url}/api/data`, {
      method: 'PUT', duplex: 'half', body, headers: { Authorization: 'Bearer tok-a', 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(413)
  })

  it('accepts a body of just under 5 MB by default and refuses just over', async () => {
    await start()
    const size = 5 * 1024 * 1024
    const fits = profile({ note: 'x'.repeat(size - 200) })
    expect((await put(0, fits)).status).toBe(200)
    const over = profile({ note: 'x'.repeat(size + 10) })
    expect((await put(1, over)).status).toBe(413)
  })

  it('429 past the per-user limit, with Retry-After, without touching other users', async () => {
    let clock = 1000
    await start({ userPermits: 2, now: () => clock })
    expect((await call('GET')).status).toBe(404)
    expect((await call('GET')).status).toBe(404)
    const limited = await call('GET')
    expect(limited.status).toBe(429)
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
    expect((await call('GET', { token: 'tok-b' })).status).toBe(404)
    clock += 60_001
    expect((await call('GET')).status).toBe(404)
  })

  it('429 after repeated bad tokens from one address', async () => {
    await start({ badAuthPermits: 2 })
    expect((await call('GET', { token: 'x1' })).status).toBe(401)
    expect((await call('GET', { token: 'x2' })).status).toBe(401)
    expect((await call('GET', { token: 'x3' })).status).toBe(429)
    expect((await call('GET', { token: 'tok-a' })).status).toBe(404)
  })

  it('reads the address from the proxy only when told to', async () => {
    await start({ badAuthPermits: 1, trustProxy: true })
    const from = ip => ({ token: 'x', headers: { 'X-Forwarded-For': `9.9.9.9, ${ip}` } })
    expect((await call('GET', from('1.1.1.1'))).status).toBe(401)
    expect((await call('GET', from('1.1.1.1'))).status).toBe(429)
    expect((await call('GET', from('2.2.2.2'))).status).toBe(401)
  })
})

describe('other routes and failures', () => {
  it('health needs no token and works', async () => {
    await start()
    const res = await call('GET', { token: null, path: '/api/health' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('404 for unknown paths, 405 for unknown methods', async () => {
    await start()
    expect((await call('GET', { path: '/api/other' })).status).toBe(404)
    const res = await call('POST', { body: {} })
    expect(res.status).toBe(405)
    expect(res.headers.get('allow')).toContain('PUT')
  })

  it('no stack trace leaves the server', async () => {
    const broken = { ...store, get() { throw new Error('secret table detail') } }
    await start({ store: broken })
    const res = await call('GET')
    expect(res.status).toBe(500)
    const text = await res.text()
    expect(text).toBe('{"error":"internal"}')
    expect(logs.join('')).not.toContain('secret table detail')
  })

  it('logs never hold tokens or profile contents', async () => {
    await start()
    await put(0, profile({ note: 'very-private-note' }))
    await call('GET')
    const text = logs.join('\n')
    expect(logs.length).toBeGreaterThan(1)
    expect(text).not.toContain('tok-a')
    expect(text).not.toContain('user-a')
    expect(text).not.toContain('very-private-note')
    expect(text).toContain('"status":200')
  })
})

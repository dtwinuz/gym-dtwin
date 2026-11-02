import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profile, Workout } from '../core/types'
import { emptyProfile, upsertItem } from './profile'
import { MAX_ATTEMPTS, PROFILE_KIND, createSyncEngine, emptyMeta, type SyncDeps, type SyncMeta } from './syncEngine'

const workout = (id: string, updatedAt: number): Workout => ({
  id, date: '2026-11-01', start: 1, end: 2, routineIds: [], name: id, entries: [], prs: [], vol: 0, updatedAt,
})
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers })

/** The API contract in memory. */
class FakeServer {
  rev = 0
  doc: Profile | null = null
  owner = 'owner-1'
  calls: { method: string; baseRev?: number; token: string | null }[] = []
  before: ((method: string, call: number) => Response | void) | null = null

  fetch: typeof fetch = async (_url, init) => {
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) as { kind: string; baseRev: number; profile: Profile } : null
    const token = new Headers(init?.headers).get('Authorization')
    this.calls.push({ method, baseRev: body?.baseRev, token })
    const early = this.before?.(method, this.calls.length)
    if (early) return early
    if (method === 'GET') {
      return this.doc ? json(200, { rev: this.rev, profile: this.doc, owner: this.owner }) : json(404, { owner: this.owner })
    }
    if (method === 'DELETE') {
      this.doc = null
      this.rev = 0
      return new Response(null, { status: 204 })
    }
    expect(body?.kind).toBe(PROFILE_KIND)
    if (body!.baseRev !== this.rev) return json(409, { rev: this.rev, profile: this.doc, owner: this.owner })
    this.rev++
    this.doc = JSON.parse(JSON.stringify(body!.profile)) as Profile
    return json(200, { rev: this.rev, owner: this.owner })
  }

  puts = () => this.calls.filter(c => c.method === 'PUT')
  /** Another device saved something between our read and our write. */
  otherDevice(id: string, at: number) {
    this.rev++
    this.doc = upsertItem(this.doc ?? emptyProfile(1, 'uz'), 'workouts', workout(id, at), at)
  }
}

function setup(over: Partial<SyncDeps> = {}, start: Profile = emptyProfile(1, 'uz'), startMeta: SyncMeta = emptyMeta()) {
  const server = new FakeServer()
  let profile = start
  let saved = startMeta
  const sleeps: number[] = []
  const deps: SyncDeps = {
    fetch: server.fetch,
    token: async () => 'tok',
    refresh: async () => 'tok2',
    getProfile: () => profile,
    applyMerged: p => { profile = p },
    loadMeta: () => saved,
    saveMeta: m => { saved = m },
    sleep: async ms => { sleeps.push(ms) },
    random: () => 0,
    now: () => 5000,
    ...over,
  }
  const engine = createSyncEngine(deps)
  return {
    server, engine, sleeps,
    profile: () => profile,
    meta: () => saved,
    setLocal: (p: Profile) => { profile = p },
  }
}

const withWorkout = (id: string, at = 10) => upsertItem(emptyProfile(1, 'uz'), 'workouts', workout(id, at), at)

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('sync engine', () => {
  it('no server copy yet: uploads the local profile with baseRev 0', async () => {
    const s = setup({}, withWorkout('a'))
    await s.engine.start()
    expect(s.server.puts()).toHaveLength(1)
    expect(s.server.puts()[0].baseRev).toBe(0)
    expect(s.server.doc?.workouts.map(w => w.id)).toEqual(['a'])
    expect(s.meta().rev).toBe(1)
    expect(s.meta().lastSyncAt).toBe(5000)
    expect(s.engine.state().status).toBe('idle')
  })

  it('server has data, local is new: pulls, merges and saves the union', async () => {
    const s = setup({}, withWorkout('local'))
    s.server.otherDevice('remote', 20)
    await s.engine.start()
    const got = s.profile().workouts.map(w => w.id).sort()
    expect(got).toEqual(['local', 'remote'])
    expect(s.server.doc?.workouts.map(w => w.id).sort()).toEqual(['local', 'remote'])
    expect(s.server.puts()[0].baseRev).toBe(1)
  })

  it('nothing differs: reads and does not write', async () => {
    const s = setup()
    s.server.otherDevice('a', 20)
    await s.engine.start()
    s.server.calls = []
    await s.engine.syncNow()
    expect(s.server.calls.map(c => c.method)).toEqual(['GET'])
  })

  it('409: merges what the server returned and writes again on the new revision', async () => {
    const s = setup({}, withWorkout('mine'))
    s.server.before = (method, call) => {
      if (method === 'PUT' && call === 2) s.server.otherDevice('theirs', 30)
    }
    await s.engine.start()
    expect(s.server.puts().map(c => c.baseRev)).toEqual([0, 1])
    expect(s.server.doc?.workouts.map(w => w.id).sort()).toEqual(['mine', 'theirs'])
    expect(s.profile().workouts.map(w => w.id).sort()).toEqual(['mine', 'theirs'])
    expect(s.sleeps).toEqual([500])
  })

  it('409 forever: stops after a bounded number of tries with growing waits, keeps the data', async () => {
    const s = setup({}, withWorkout('mine'))
    s.server.before = method => {
      if (method === 'PUT') s.server.otherDevice(`t${s.server.rev}`, 30 + s.server.rev)
    }
    s.engine.localChange()
    await s.engine.start()
    expect(s.server.puts()).toHaveLength(MAX_ATTEMPTS)
    expect(s.sleeps).toEqual([500, 1000, 2000, 4000])
    expect(s.engine.state().status).toBe('error')
    expect(s.meta().dirty).toBe(true)
    expect(s.profile().workouts.some(w => w.id === 'mine')).toBe(true)
  })

  it('a retry follows a failed cycle by itself', async () => {
    const s = setup({}, withWorkout('mine'))
    s.server.before = () => json(500, { error: 'internal' })
    await s.engine.start()
    expect(s.engine.state().status).toBe('error')
    s.server.before = null
    await vi.advanceTimersByTimeAsync(5000)
    expect(s.engine.state().status).toBe('idle')
    expect(s.server.doc).not.toBeNull()
  })

  it('offline: keeps the dirty flag, says so, then delivers when the network returns', async () => {
    const s = setup({}, withWorkout('mine'))
    s.server.before = () => { throw new TypeError('network') }
    s.engine.localChange()
    await s.engine.start()
    expect(s.engine.state().status).toBe('offline')
    expect(s.meta().dirty).toBe(true)
    s.server.before = null
    await s.engine.syncNow()
    expect(s.engine.state().status).toBe('idle')
    expect(s.meta().dirty).toBe(false)
    expect(s.server.doc?.workouts).toHaveLength(1)
  })

  it('a dirty flag survives a restart and is sent', async () => {
    const s = setup({}, withWorkout('mine'), { ...emptyMeta(), dirty: true })
    await s.engine.start()
    expect(s.server.doc?.workouts).toHaveLength(1)
    expect(s.meta().dirty).toBe(false)
  })

  it('debounces local changes into one sync', async () => {
    const s = setup()
    await s.engine.start()
    s.server.calls = []
    s.engine.localChange()
    await vi.advanceTimersByTimeAsync(1000)
    s.engine.localChange()
    await vi.advanceTimersByTimeAsync(1000)
    s.engine.localChange()
    expect(s.server.calls).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(2000)
    expect(s.server.calls.map(c => c.method).filter(m => m === 'GET')).toHaveLength(1)
  })

  it('an edit while the write is in flight is not lost', async () => {
    const s = setup({}, withWorkout('a'))
    s.server.before = (method) => {
      if (method === 'PUT') s.setLocal(upsertItem(s.profile(), 'workouts', workout('during', 50), 50))
    }
    await s.engine.start()
    expect(s.meta().dirty).toBe(true)
    s.server.before = null
    await vi.advanceTimersByTimeAsync(2000)
    expect(s.server.doc?.workouts.map(w => w.id).sort()).toEqual(['a', 'during'])
    expect(s.meta().dirty).toBe(false)
  })

  it('401: refreshes once and repeats with the new token', async () => {
    const s = setup({}, withWorkout('a'))
    s.server.before = (_m, call) => (call === 1 ? json(401, { error: 'unauthorized' }) : undefined)
    await s.engine.start()
    expect(s.server.calls[0].token).toBe('Bearer tok')
    expect(s.server.calls[1].token).toBe('Bearer tok2')
    expect(s.engine.state().status).toBe('idle')
  })

  it('401 with no way to refresh: asks to sign in, keeps the dirty flag', async () => {
    const s = setup({ refresh: async () => null }, withWorkout('a'), { ...emptyMeta(), dirty: true })
    s.server.before = () => json(401, { error: 'unauthorized' })
    await s.engine.start()
    expect(s.engine.state().status).toBe('auth')
    expect(s.meta().dirty).toBe(true)
  })

  it('no token at all: no network', async () => {
    const s = setup({ token: async () => null })
    await s.engine.start()
    expect(s.server.calls).toHaveLength(0)
    expect(s.engine.state().status).toBe('auth')
  })

  it('never reaches the network before start', async () => {
    const s = setup()
    s.engine.localChange()
    await s.engine.syncNow()
    await vi.advanceTimersByTimeAsync(600_000)
    expect(s.server.calls).toHaveLength(0)
    expect(s.engine.state().status).toBe('guest')
  })

  it('429: waits as told, capped, then continues', async () => {
    const s = setup({}, withWorkout('a'))
    s.server.before = (_m, call) => (call === 1 ? json(429, { error: 'rate_limited' }, { 'Retry-After': '7' }) : undefined)
    await s.engine.start()
    expect(s.sleeps[0]).toBe(7000)
    expect(s.engine.state().status).toBe('idle')
  })

  it('413: stops and keeps the local data', async () => {
    const s = setup({}, withWorkout('a'), { ...emptyMeta(), dirty: true })
    s.server.before = method => (method === 'PUT' ? json(413, { error: 'too_large' }) : undefined)
    await s.engine.start()
    expect(s.engine.state().status).toBe('tooLarge')
    expect(s.meta().dirty).toBe(true)
  })

  it('a malformed answer changes nothing locally', async () => {
    const before = withWorkout('a')
    const s = setup({}, before)
    s.server.before = () => json(200, { rev: 3, profile: { workouts: 'nope' } })
    await s.engine.start()
    expect(s.profile()).toBe(before)
    expect(s.engine.state().status).toBe('error')
  })

  it('delete: removes the server copy, stops uploading until asked, local data stays', async () => {
    const s = setup({}, withWorkout('a'))
    await s.engine.start()
    expect(await s.engine.deleteServerData()).toBe(true)
    expect(s.server.doc).toBeNull()
    expect(s.engine.state().status).toBe('paused')
    expect(s.profile().workouts).toHaveLength(1)
    s.engine.localChange()
    await vi.advanceTimersByTimeAsync(600_000)
    await s.engine.syncNow()
    expect(s.server.doc).toBeNull()
    await s.engine.resume()
    expect(s.server.doc?.workouts).toHaveLength(1)
    expect(s.engine.state().status).toBe('idle')
  })

  it('delete that fails reports it and keeps syncing state', async () => {
    const s = setup({}, withWorkout('a'))
    await s.engine.start()
    s.server.before = method => (method === 'DELETE' ? json(500, { error: 'internal' }) : undefined)
    expect(await s.engine.deleteServerData()).toBe(false)
    expect(s.meta().paused).toBe(false)
  })

  it('wiped from another device: this one pauses instead of uploading it back', async () => {
    const s = setup({}, withWorkout('a'))
    await s.engine.start()
    s.server.doc = null
    s.server.rev = 0
    s.server.calls = []
    await s.engine.syncNow()
    expect(s.server.puts()).toHaveLength(0)
    expect(s.engine.state().status).toBe('paused')
    expect(s.meta().paused).toBe(true)
  })

  it('wiped while a write is on its way (409 with no profile): also pauses', async () => {
    const s = setup({}, withWorkout('a'))
    await s.engine.start()
    s.setLocal(upsertItem(s.profile(), 'workouts', workout('b', 50), 50))
    s.server.before = method => (method === 'PUT' ? json(409, { rev: 0, profile: null }) : undefined)
    await s.engine.syncNow()
    expect(s.engine.state().status).toBe('paused')
  })

  it('a different account stops before anything is merged or sent', async () => {
    const before = withWorkout('first-account')
    const s = setup({}, before, { ...emptyMeta(), owner: 'owner-1' })
    s.server.owner = 'owner-2'
    s.server.otherDevice('second-account', 20)
    await s.engine.start()
    expect(s.engine.state().status).toBe('mismatch')
    expect(s.profile()).toBe(before)
    expect(s.server.puts()).toHaveLength(0)
    await s.engine.acceptAccount()
    expect(s.profile().workouts).toHaveLength(2)
    expect(s.meta().owner).toBe('owner-2')
  })

  it('sign out forgets the server position, keeps the data and the owner', async () => {
    const s = setup({}, withWorkout('a'))
    await s.engine.start()
    s.engine.signedOut()
    expect(s.engine.state().status).toBe('guest')
    expect(s.meta().rev).toBe(0)
    expect(s.meta().owner).toBe('owner-1')
    expect(s.profile().workouts).toHaveLength(1)
    s.server.calls = []
    s.engine.localChange()
    await vi.advanceTimersByTimeAsync(600_000)
    expect(s.server.calls).toHaveLength(0)
  })

  it('two devices against one server converge', async () => {
    const a = setup({}, withWorkout('from-a', 10))
    const b = setup({ fetch: a.server.fetch }, withWorkout('from-b', 20))
    await a.engine.start()
    await b.engine.start()
    await a.engine.syncNow()
    const names = (p: Profile) => p.workouts.map(w => w.id).sort()
    expect(names(a.profile())).toEqual(['from-a', 'from-b'])
    expect(names(b.profile())).toEqual(['from-a', 'from-b'])
  })
})

describe('privacy', () => {
  it('sync code does not touch the photo store', () => {
    for (const file of ['sync.ts', 'syncEngine.ts', 'syncBoot.ts', 'auth.ts']) {
      const text = readFileSync(join(__dirname, file), 'utf8')
      expect(text).not.toMatch(/photos|indexedDB/i)
    }
  })
})

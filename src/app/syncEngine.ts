import type { Ms, Profile } from '../core/types'
import { readProfile } from './data/backup'
import { mergeProfiles, sameDoc } from './sync'

export const PROFILE_KIND = 'gym-dtwin-profile'
export const API_PATH = '/api/data'
export const META_KEY = 'gym-dtwin:sync'
export const MAX_ATTEMPTS = 5
const BACKOFF_MS = 500
const RETRY_MS = 5000
const RETRY_CAP_MS = 300_000
const RETRY_AFTER_CAP_MS = 60_000
const DEBOUNCE_MS = 2000

export type SyncStatus = 'guest' | 'idle' | 'syncing' | 'offline' | 'error' | 'paused' | 'mismatch' | 'tooLarge' | 'auth'

export interface SyncMeta {
  rev: number
  dirty: boolean
  lastSyncAt: Ms | null
  owner: string | null
  paused: boolean
}

export const emptyMeta = (): SyncMeta => ({ rev: 0, dirty: false, lastSyncAt: null, owner: null, paused: false })

export interface SyncState { status: SyncStatus; dirty: boolean; lastSyncAt: Ms | null }

export interface SyncDeps {
  fetch: typeof fetch
  apiBase?: string
  token: () => Promise<string | null>
  refresh: () => Promise<string | null>
  getProfile: () => Profile
  applyMerged: (p: Profile) => void
  loadMeta: () => SyncMeta
  saveMeta: (m: SyncMeta) => void
  now?: () => Ms
  sleep?: (ms: number) => Promise<void>
  random?: () => number
  debounceMs?: number
}

class Stop extends Error {
  status: SyncStatus
  constructor(status: SyncStatus) {
    super(status)
    this.status = status
  }
}

/** A failure worth retrying by itself later. */
class Later extends Error {}

interface Remote { rev: number; profile: Profile | null; owner?: string }

export function createSyncEngine(d: SyncDeps) {
  const now = d.now ?? Date.now
  const sleep = d.sleep ?? ((ms: number) => new Promise<void>(res => setTimeout(res, ms)))
  const random = d.random ?? Math.random
  const url = `${d.apiBase ?? ''}${API_PATH}`
  const debounceMs = d.debounceMs ?? DEBOUNCE_MS

  let meta = d.loadMeta()
  let status: SyncStatus = 'guest'
  let snapshot: SyncState = { status, dirty: meta.dirty, lastSyncAt: meta.lastSyncAt }
  let live = false
  let holdPut = false
  let current: Promise<void> | null = null
  let again = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let failures = 0
  const listeners = new Set<() => void>()

  function publish() {
    snapshot = { status, dirty: meta.dirty, lastSyncAt: meta.lastSyncAt }
    listeners.forEach(l => l())
  }

  function setMeta(patch: Partial<SyncMeta>) {
    meta = { ...meta, ...patch }
    d.saveMeta(meta)
  }

  function setStatus(next: SyncStatus) {
    status = next
    publish()
  }

  function cancelTimer() {
    if (timer != null) clearTimeout(timer)
    timer = null
  }

  function schedule(ms: number) {
    cancelTimer()
    timer = setTimeout(() => {
      timer = null
      void run()
    }, ms)
  }

  async function call(method: string, body?: unknown): Promise<Response> {
    let token = await d.token()
    if (!token) throw new Stop('auth')
    const send = (bearer: string) => d.fetch(url, {
      method,
      headers: { Authorization: `Bearer ${bearer}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    let res = await send(token)
    if (res.status === 401) {
      token = await d.refresh()
      if (!token) throw new Stop('auth')
      res = await send(token)
      if (res.status === 401) throw new Stop('auth')
    }
    return res
  }

  /** Wait as the server asks, or fail for now when it is simply unhealthy. */
  async function pace(res: Response) {
    if (res.status !== 429) throw new Later(String(res.status))
    const seconds = Number(res.headers.get('Retry-After') ?? 1) || 1
    await sleep(Math.min(Math.max(seconds, 1) * 1000, RETRY_AFTER_CAP_MS))
  }

  async function readRemote(res: Response): Promise<Remote> {
    const body = await res.json() as { rev?: unknown; profile?: unknown; owner?: unknown }
    const profile = body.profile == null ? null : readProfile(body.profile)
    if ((body.profile != null && !profile) || typeof body.rev !== 'number') throw new Later('shape')
    return { rev: body.rev, profile, owner: typeof body.owner === 'string' ? body.owner : undefined }
  }

  function checkOwner(owner: string | undefined) {
    if (!owner) return
    if (meta.owner && meta.owner !== owner) throw new Stop('mismatch')
    if (meta.owner !== owner) setMeta({ owner })
  }

  function synced(rev: number, seen: Profile) {
    setMeta({ rev, lastSyncAt: now(), dirty: d.getProfile() !== seen })
    failures = 0
    setStatus('idle')
    if (meta.dirty) schedule(debounceMs)
  }

  function serverWiped(): never {
    setMeta({ rev: 0, paused: true, dirty: false })
    throw new Stop('paused')
  }

  async function cycle() {
    let remote: Remote | null = null
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) await sleep(BACKOFF_MS * 2 ** (attempt - 1) * (1 + random()))
      if (!live || holdPut) return
      if (!remote) {
        const res = await call('GET')
        if (res.status === 404) {
          const { owner } = await res.json().catch(() => ({})) as { owner?: string }
          checkOwner(owner)
          if (meta.rev > 0) serverWiped()
          remote = { rev: 0, profile: null }
        } else if (res.ok) {
          remote = await readRemote(res)
          checkOwner(remote.owner)
        } else {
          await pace(res)
          continue
        }
      }
      if (!live || holdPut) return

      const local = d.getProfile()
      const merged = remote.profile ? mergeProfiles(local, remote.profile) : local
      let seen = local
      if (merged !== local && !sameDoc(merged, local)) {
        d.applyMerged(merged)
        seen = merged
      }
      if (remote.profile && sameDoc(merged, remote.profile)) {
        synced(remote.rev, seen)
        return
      }

      const res = await call('PUT', { kind: PROFILE_KIND, baseRev: remote.rev, profile: merged })
      if (res.ok) {
        const body = await res.json() as { rev: number }
        synced(body.rev, seen)
        return
      }
      if (res.status === 409) {
        remote = await readRemote(res)
        if (!remote.profile && meta.rev > 0) serverWiped()
        continue
      }
      if (res.status === 413) throw new Stop('tooLarge')
      remote = null
      await pace(res)
    }
    throw new Later('attempts')
  }

  function run(): Promise<void> {
    if (current) {
      again = true
      return current
    }
    if (!live || meta.paused) return Promise.resolve()
    cancelTimer()
    current = (async () => {
      setStatus('syncing')
      try {
        await cycle()
      } catch (e) {
        if (e instanceof Stop) {
          setStatus(e.status)
        } else {
          failures++
          setStatus(e instanceof Later ? 'error' : 'offline')
          if (live) schedule(Math.min(RETRY_CAP_MS, RETRY_MS * 2 ** (failures - 1)) * (1 + random() / 2))
        }
      } finally {
        current = null
      }
      if (again) {
        again = false
        await run()
      }
    })()
    return current
  }

  return {
    state: () => snapshot,
    subscribe(cb: () => void) {
      listeners.add(cb)
      return () => { listeners.delete(cb) }
    },

    /** Signed in: start or continue. Guests never reach this. */
    start(): Promise<void> {
      live = true
      if (meta.paused) {
        setStatus('paused')
        return Promise.resolve()
      }
      return run()
    },

    /** The app changed the profile. Remembered across restarts, sent after a pause. */
    localChange() {
      if (!meta.dirty) setMeta({ dirty: true })
      publish()
      if (live && !meta.paused && status !== 'mismatch') schedule(debounceMs)
    },

    syncNow: () => run(),

    /** Forget what this device knew about the server; its data stays. */
    signedOut() {
      live = false
      again = false
      cancelTimer()
      setMeta({ rev: 0, dirty: false, paused: false })
      setStatus('guest')
    },

    /** Empty the server copy and stop uploading until the user asks. */
    async deleteServerData(): Promise<boolean> {
      holdPut = true
      cancelTimer()
      try {
        await current
        const res = await call('DELETE')
        if (!res.ok) return false
        setMeta({ rev: 0, paused: true, dirty: false })
        setStatus('paused')
        return true
      } catch {
        return false
      } finally {
        holdPut = false
      }
    },

    /** Upload again after a server wipe. */
    resume(): Promise<void> {
      setMeta({ rev: 0, paused: false, dirty: true })
      return run()
    },

    /** The user chose to bring this device's data into the account it is signed in to. */
    acceptAccount(): Promise<void> {
      setMeta({ owner: null, rev: 0 })
      return run()
    },
  }
}

export type SyncEngine = ReturnType<typeof createSyncEngine>

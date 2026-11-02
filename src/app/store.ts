import { useSyncExternalStore } from 'react'
import type { Ms, Profile, Settings } from '../core/types'
import { migrateLegacy, type LegacyState } from './legacy'
import { deleteItem, normalizeProfile, upsertItem, emptyProfile, type ListItems, type ListKey } from './profile'
import { stampChanges } from './sync'

export const KEY = 'gym-dtwin:v2'
export const LEGACY_KEY = 'gym-dtwin:v1'

type KV = Pick<Storage, 'getItem' | 'setItem'>

export function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

const storage = (): KV | null => browserStorage()

/** v2 if present, else a one-time migration of v1, else a fresh profile. Never throws. */
export function loadProfile(kv: KV | null, now: Ms = Date.now()): Profile {
  try {
    const raw = kv?.getItem(KEY)
    if (raw) return normalizeProfile(JSON.parse(raw), now)
    const old = kv?.getItem(LEGACY_KEY)
    if (old) {
      const p = migrateLegacy(JSON.parse(old) as LegacyState, now)
      save(kv, p)
      return p
    }
  } catch {
    // corrupt or unreadable storage: start clean in memory
  }
  return emptyProfile(now)
}

function save(kv: KV | null, p: Profile) {
  try {
    kv?.setItem(KEY, JSON.stringify(p))
  } catch {
    // storage full or blocked: keep working in memory
  }
}

let profile = loadProfile(storage())
const listeners = new Set<() => void>()

export const getProfile = () => profile

function stamped(next: Profile): Profile {
  const at = Math.max(Date.now(), profile.updatedAt + 1)
  return { ...(import.meta.env.VITE_SYNC_ENABLED === 'true' ? stampChanges(profile, next, at) : next), updatedAt: at }
}

export function updateProfile(fn: (p: Profile) => Profile) {
  const next = fn(profile)
  if (next === profile) return
  profile = stamped(next)
  save(storage(), profile)
  listeners.forEach(l => l())
}

/** Swap in a whole profile only if it can be stored; false = nothing changed. */
export function commitProfile(p: Profile): boolean {
  const next = stamped(p)
  try {
    storage()?.setItem(KEY, JSON.stringify(next))
  } catch {
    return false
  }
  profile = next
  listeners.forEach(l => l())
  return true
}

export function replaceProfile(p: Profile) {
  profile = p
  listeners.forEach(l => l())
}

/** A merge result from the server: stored as it is, not a local edit. */
export function applyRemoteProfile(p: Profile) {
  profile = p
  save(storage(), p)
  listeners.forEach(l => l())
}

export const updateSettings = (patch: Partial<Settings>) =>
  updateProfile(p => ({ ...p, settings: { ...p.settings, ...patch } }))

export const upsert = <K extends ListKey>(list: K, item: ListItems[K]) => updateProfile(p => upsertItem(p, list, item))
export const remove = <K extends ListKey>(list: K, id: string) => updateProfile(p => deleteItem(p, list, id))

export const subscribeProfile = (cb: () => void) => {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function useProfile(): Profile {
  return useSyncExternalStore(subscribeProfile, getProfile, getProfile)
}

export const useSettings = () => useProfile().settings

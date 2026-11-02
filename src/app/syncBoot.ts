import { useSyncExternalStore } from 'react'
import { AUTH_PATH, createAuth, browserLock } from './auth'
import { applyRemoteProfile, browserStorage, getProfile, subscribeProfile } from './store'
import { META_KEY, createSyncEngine, emptyMeta, type SyncMeta } from './syncEngine'

const PULL_MS = 300_000

function session() {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

export const auth = createAuth({
  issuer: import.meta.env.VITE_DTWIN_ISSUER ?? '',
  clientId: import.meta.env.VITE_DTWIN_CLIENT_ID ?? 'gym-dtwin',
  origin: location.origin,
  fetch: (...args) => fetch(...args),
  local: browserStorage(),
  session: session(),
  navigate: url => location.assign(url),
  lock: browserLock,
})

function loadMeta(): SyncMeta {
  try {
    return { ...emptyMeta(), ...JSON.parse(browserStorage()?.getItem(META_KEY) ?? '{}') as Partial<SyncMeta> }
  } catch {
    return emptyMeta()
  }
}

function saveMeta(m: SyncMeta) {
  try {
    browserStorage()?.setItem(META_KEY, JSON.stringify(m))
  } catch {
    // blocked storage: the dirty flag lasts until the tab closes
  }
}

let applying = false

export const engine = createSyncEngine({
  fetch: (...args) => fetch(...args),
  token: () => auth.accessToken(),
  refresh: () => auth.refresh(),
  getProfile,
  applyMerged: p => {
    applying = true
    try {
      applyRemoteProfile(p)
    } finally {
      applying = false
    }
  },
  loadMeta,
  saveMeta,
})

export const useSyncState = () => useSyncExternalStore(engine.subscribe, engine.state, engine.state)

/** Back from dtwin: finish the login, drop the code from the URL and open Settings. */
export async function finishRedirect() {
  const result = await auth.finishLogin(location.search)
  history.replaceState(null, '', `/#/settings${result.ok ? '' : `?login=${result.error}`}`)
}

export async function signOut() {
  engine.signedOut()
  await auth.signOut()
}

export async function startSync() {
  if (location.pathname === AUTH_PATH) await finishRedirect()
  subscribeProfile(() => {
    if (!applying) engine.localChange()
  })
  const pull = () => {
    if (auth.signedIn() && document.visibilityState === 'visible') void engine.syncNow()
  }
  window.addEventListener('online', pull)
  window.addEventListener('offline', pull)
  document.addEventListener('visibilitychange', pull)
  setInterval(pull, PULL_MS)
  if (auth.signedIn()) void engine.start()
}

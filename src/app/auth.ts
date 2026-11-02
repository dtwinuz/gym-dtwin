import type { Ms } from '../core/types'

export const RT_KEY = 'gym-dtwin:rt'
const PENDING_KEY = 'gym-dtwin:oauth'
const LOCK = 'gym-dtwin-refresh'
const EARLY_MS = 60_000
export const AUTH_PATH = '/auth/callback'
export const AUTH_SCOPE = 'gym'

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface AuthDeps {
  issuer: string
  clientId: string
  origin: string
  fetch: typeof fetch
  /** Survives a restart: only the rotating refresh token goes here. */
  local: KV | null
  /** Survives the redirect: only the PKCE verifier and state go here. */
  session: KV | null
  navigate: (url: string) => void
  now?: () => Ms
  /** One refresh at a time across tabs: a reused token revokes the whole dtwin grant. */
  lock?: <T>(run: () => Promise<T>) => Promise<T>
}

export type LoginError = 'denied' | 'state' | 'issuer' | 'exchange'
export type LoginResult = { ok: true } | { ok: false; error: LoginError }

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const randomText = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)))

export async function pkceChallenge(verifier: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
}

export function browserLock<T>(run: () => Promise<T>): Promise<T> {
  return typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request(LOCK, run) as Promise<T> : run()
}

function read(kv: KV | null, key: string): string | null {
  try {
    return kv?.getItem(key) ?? null
  } catch {
    return null
  }
}

function write(kv: KV | null, key: string, value: string | null) {
  try {
    if (value == null) kv?.removeItem(key)
    else kv?.setItem(key, value)
  } catch {
    // blocked storage: the session lasts until the tab closes
  }
}

interface TokenReply { access_token?: string; refresh_token?: string; expires_in?: number }

export function createAuth(d: AuthDeps) {
  const now = d.now ?? Date.now
  const lock = d.lock ?? (run => run())
  const issuer = d.issuer.replace(/\/+$/, '')
  const redirectUri = `${d.origin}${AUTH_PATH}`
  let access: { token: string; until: Ms } | null = null
  let memoryRefresh: string | null = null
  let inFlight: Promise<string | null> | null = null

  const currentRefresh = () => read(d.local, RT_KEY) ?? memoryRefresh

  function hold(reply: TokenReply) {
    access = { token: reply.access_token!, until: now() + Number(reply.expires_in ?? 0) * 1000 - EARLY_MS }
  }

  const post = (grant: Record<string, string>) => d.fetch(`${issuer}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...grant, client_id: d.clientId }),
  })

  function clear() {
    access = null
    memoryRefresh = null
    write(d.local, RT_KEY, null)
  }

  async function refreshOnce(): Promise<string | null> {
    const held = currentRefresh()
    if (!held) {
      clear()
      return null
    }
    const res = await post({ grant_type: 'refresh_token', refresh_token: held })
    if (res.status === 400 || res.status === 401) {
      clear()
      return null
    }
    if (!res.ok) throw new Error(`token ${res.status}`)
    const reply = await res.json() as TokenReply
    if (!reply.access_token) {
      clear()
      return null
    }
    hold(reply)
    memoryRefresh = reply.refresh_token ?? held
    write(d.local, RT_KEY, reply.refresh_token ?? null)
    return reply.access_token
  }

  /** A new access token; null means sign in again, a throw means try again later. */
  function refresh(): Promise<string | null> {
    inFlight ??= lock(refreshOnce).finally(() => { inFlight = null })
    return inFlight
  }

  return {
    signedIn: () => access != null || currentRefresh() != null,

    async accessToken(): Promise<string | null> {
      if (access && now() < access.until) return access.token
      return currentRefresh() ? refresh() : null
    },

    refresh,

    async beginLogin() {
      const verifier = randomText(48)
      const state = randomText(24)
      write(d.session, PENDING_KEY, JSON.stringify({ verifier, state }))
      const q = new URLSearchParams({
        response_type: 'code',
        client_id: d.clientId,
        redirect_uri: redirectUri,
        scope: AUTH_SCOPE,
        state,
        code_challenge: await pkceChallenge(verifier),
        code_challenge_method: 'S256',
      })
      d.navigate(`${issuer}/oauth/authorize?${q}`)
    },

    /** Handle the redirect back. The state and verifier work once, whatever the outcome. */
    async finishLogin(search: string): Promise<LoginResult> {
      const q = new URLSearchParams(search)
      let pending: { verifier?: string; state?: string } = {}
      try {
        pending = JSON.parse(read(d.session, PENDING_KEY) ?? '{}') as typeof pending
      } catch {
        // unreadable: fails the state check below
      }
      write(d.session, PENDING_KEY, null)
      if (!pending.state || !pending.verifier || q.get('state') !== pending.state) return { ok: false, error: 'state' }
      const iss = q.get('iss')
      if (iss != null && iss.replace(/\/+$/, '') !== issuer) return { ok: false, error: 'issuer' }
      const code = q.get('code')
      if (!code) return { ok: false, error: 'denied' }
      try {
        const res = await post({ grant_type: 'authorization_code', code, code_verifier: pending.verifier, redirect_uri: redirectUri })
        if (!res.ok) return { ok: false, error: 'exchange' }
        const reply = await res.json() as TokenReply
        if (!reply.access_token) return { ok: false, error: 'exchange' }
        hold(reply)
        memoryRefresh = reply.refresh_token ?? null
        write(d.local, RT_KEY, memoryRefresh)
        return { ok: true }
      } catch {
        return { ok: false, error: 'exchange' }
      }
    },

    /** Local state goes first, so a failed revoke still signs out. */
    async signOut() {
      const tokens = [access?.token, currentRefresh()].filter((x): x is string => !!x)
      clear()
      await Promise.all(tokens.map(token => d.fetch(`${issuer}/oauth/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
      }).catch(() => undefined)))
    },
  }
}

export type Auth = ReturnType<typeof createAuth>

import { describe, expect, it } from 'vitest'
import { AUTH_SCOPE, RT_KEY, createAuth, pkceChallenge, type AuthDeps } from './auth'

function kv(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v) },
    removeItem: (k: string) => { m.delete(k) },
    has: (k: string) => m.has(k),
  }
}

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
const form = (init?: RequestInit) => new URLSearchParams(String(init?.body))

function setup(over: Partial<AuthDeps> = {}, replies: (Response | Error)[] = []) {
  const calls: { url: string; body: URLSearchParams }[] = []
  const local = kv()
  const session = kv()
  let navigated = ''
  const auth = createAuth({
    issuer: 'https://id.test/',
    clientId: 'gym-dtwin',
    origin: 'https://gym.test',
    local,
    session,
    navigate: url => { navigated = url },
    now: () => 1000,
    fetch: (async (url: string, init?: RequestInit) => {
      calls.push({ url, body: form(init) })
      const next = replies.shift()
      if (next instanceof Error) throw next
      return next ?? ok({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 })
    }) as typeof fetch,
    ...over,
  })
  return { auth, calls, local, session, url: () => new URL(navigated) }
}

async function loggedIn(s: ReturnType<typeof setup>) {
  await s.auth.beginLogin()
  return s.auth.finishLogin(`?code=c1&state=${s.url().searchParams.get('state')}`)
}

describe('auth', () => {
  it('guest by default: no tokens, no network', async () => {
    const s = setup()
    expect(s.auth.signedIn()).toBe(false)
    expect(await s.auth.accessToken()).toBeNull()
    expect(s.calls).toHaveLength(0)
  })

  it('computes the RFC 7636 example challenge', async () => {
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('login goes to the issuer with PKCE S256, state and the real callback path', async () => {
    const s = setup()
    await s.auth.beginLogin()
    const u = s.url()
    expect(u.origin + u.pathname).toBe('https://id.test/oauth/authorize')
    const q = u.searchParams
    expect(q.get('response_type')).toBe('code')
    expect(q.get('client_id')).toBe('gym-dtwin')
    expect(q.get('redirect_uri')).toBe('https://gym.test/auth/callback')
    expect(q.get('scope')).toBe(AUTH_SCOPE)
    expect(q.get('code_challenge_method')).toBe('S256')
    const saved = JSON.parse(s.session.getItem('gym-dtwin:oauth')!) as { verifier: string; state: string }
    expect(saved.state).toBe(q.get('state'))
    expect(q.get('code_challenge')).toBe(await pkceChallenge(saved.verifier))
    expect(saved.verifier.length).toBeGreaterThanOrEqual(43)
  })

  it('finishes with the code and the verifier', async () => {
    const s = setup()
    await s.auth.beginLogin()
    const saved = JSON.parse(s.session.getItem('gym-dtwin:oauth')!) as { verifier: string; state: string }
    const r = await s.auth.finishLogin(`?code=abc&state=${saved.state}&iss=${encodeURIComponent('https://id.test')}`)
    expect(r).toEqual({ ok: true })
    const { url, body } = s.calls[0]
    expect(url).toBe('https://id.test/oauth/token')
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('abc')
    expect(body.get('code_verifier')).toBe(saved.verifier)
    expect(body.get('redirect_uri')).toBe('https://gym.test/auth/callback')
    expect(await s.auth.accessToken()).toBe('at')
    expect(s.session.has('gym-dtwin:oauth')).toBe(false)
  })

  it('rejects a wrong state, and the pending login cannot be retried', async () => {
    const s = setup()
    await s.auth.beginLogin()
    const state = s.url().searchParams.get('state')
    expect(await s.auth.finishLogin('?code=abc&state=forged')).toEqual({ ok: false, error: 'state' })
    expect(await s.auth.finishLogin(`?code=abc&state=${state}`)).toEqual({ ok: false, error: 'state' })
    expect(s.calls).toHaveLength(0)
  })

  it('rejects a callback with no login in progress', async () => {
    expect(await setup().auth.finishLogin('?code=abc&state=x')).toEqual({ ok: false, error: 'state' })
  })

  it('rejects a code from another issuer (mix-up)', async () => {
    const s = setup()
    await s.auth.beginLogin()
    const r = await s.auth.finishLogin(`?code=abc&state=${s.url().searchParams.get('state')}&iss=https%3A%2F%2Fevil.test`)
    expect(r).toEqual({ ok: false, error: 'issuer' })
    expect(s.calls).toHaveLength(0)
  })

  it('reports a refused consent and a failed exchange', async () => {
    const s = setup()
    await s.auth.beginLogin()
    expect(await s.auth.finishLogin(`?error=access_denied&state=${s.url().searchParams.get('state')}`)).toEqual({ ok: false, error: 'denied' })
    const t = setup({}, [new Response('{}', { status: 400 })])
    await t.auth.beginLogin()
    expect(await t.auth.finishLogin(`?code=x&state=${t.url().searchParams.get('state')}`)).toEqual({ ok: false, error: 'exchange' })
    expect(t.auth.signedIn()).toBe(false)
  })

  it('keeps the access token in memory and only the refresh token in storage', async () => {
    const s = setup()
    await loggedIn(s)
    expect(s.local.getItem(RT_KEY)).toBe('rt')
    const stored = JSON.stringify([s.local, s.session].map(k => k.getItem('gym-dtwin:oauth')))
    expect(stored).not.toContain('at')
  })

  it('reuses a live access token', async () => {
    const s = setup()
    await loggedIn(s)
    s.calls.length = 0
    expect(await s.auth.accessToken()).toBe('at')
    expect(s.calls).toHaveLength(0)
  })

  it('after a restart refreshes from storage and stores the rotated token', async () => {
    const s = setup({}, [ok({ access_token: 'at2', refresh_token: 'rt2', expires_in: 3600 })])
    s.local.setItem(RT_KEY, 'rt1')
    expect(s.auth.signedIn()).toBe(true)
    expect(await s.auth.accessToken()).toBe('at2')
    expect(s.calls[0].body.get('refresh_token')).toBe('rt1')
    expect(s.calls[0].body.get('client_id')).toBe('gym-dtwin')
    expect(s.local.getItem(RT_KEY)).toBe('rt2')
  })

  it('a server that does not rotate: the token leaves storage and stays in memory', async () => {
    const s = setup({}, [ok({ access_token: 'at2', expires_in: 0 }), ok({ access_token: 'at3', expires_in: 3600 })])
    s.local.setItem(RT_KEY, 'rt1')
    expect(await s.auth.accessToken()).toBe('at2')
    expect(s.local.has(RT_KEY)).toBe(false)
    expect(s.auth.signedIn()).toBe(true)
    expect(await s.auth.accessToken()).toBe('at3')
    expect(s.calls[1].body.get('refresh_token')).toBe('rt1')
  })

  it('parallel refreshes in a tab make one request', async () => {
    const s = setup()
    s.local.setItem(RT_KEY, 'rt1')
    const [a, b] = await Promise.all([s.auth.refresh(), s.auth.refresh()])
    expect(a).toBe(b)
    expect(s.calls).toHaveLength(1)
  })

  it('refresh runs inside the cross-tab lock and reads the token there', async () => {
    let locked = 0
    const s = setup({ lock: async run => { locked++; s.local.setItem(RT_KEY, 'from-other-tab'); return run() } })
    s.local.setItem(RT_KEY, 'rt1')
    await s.auth.refresh()
    expect(locked).toBe(1)
    expect(s.calls[0].body.get('refresh_token')).toBe('from-other-tab')
  })

  it('a refused refresh signs out; a network failure does not', async () => {
    const s = setup({}, [new TypeError('network'), new Response('{}', { status: 400 })])
    s.local.setItem(RT_KEY, 'rt1')
    await expect(s.auth.refresh()).rejects.toThrow()
    expect(s.local.getItem(RT_KEY)).toBe('rt1')
    expect(await s.auth.refresh()).toBeNull()
    expect(s.local.has(RT_KEY)).toBe(false)
    expect(s.auth.signedIn()).toBe(false)
  })

  it('a dtwin outage on refresh is not a sign-out', async () => {
    const s = setup({}, [new Response('', { status: 503 })])
    s.local.setItem(RT_KEY, 'rt1')
    await expect(s.auth.refresh()).rejects.toThrow()
    expect(s.auth.signedIn()).toBe(true)
  })

  it('sign out revokes both tokens and clears even if revoking fails', async () => {
    const s = setup()
    await loggedIn(s)
    s.calls.length = 0
    await s.auth.signOut()
    expect(s.calls.map(c => c.url)).toEqual(['https://id.test/oauth/revoke', 'https://id.test/oauth/revoke'])
    expect(s.calls.map(c => c.body.get('token')).sort()).toEqual(['at', 'rt'])
    expect(s.local.has(RT_KEY)).toBe(false)
    expect(s.auth.signedIn()).toBe(false)

    const t = setup()
    await loggedIn(t)
    const failing = setup({ fetch: (async () => { throw new TypeError('network') }) as typeof fetch })
    failing.local.setItem(RT_KEY, 'rt')
    await failing.auth.signOut()
    expect(failing.auth.signedIn()).toBe(false)
  })

  it('works when storage is blocked', async () => {
    const blocked = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
    }
    const s = setup({ local: blocked })
    await s.auth.beginLogin()
    expect(await s.auth.finishLogin(`?code=x&state=${s.url().searchParams.get('state')}`)).toEqual({ ok: true })
    expect(await s.auth.accessToken()).toBe('at')
  })
})

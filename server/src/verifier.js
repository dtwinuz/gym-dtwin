import { createHash } from 'node:crypto'

/**
 * @typedef {{ userId: string, telegram?: boolean }} Identity
 * @typedef {{ verify(token: string): Promise<Identity | null>, forget?(userId: string): void }} Verifier
 *   null = the token is not valid; a throw = the check itself failed (answered as 503).
 *   forget drops cached answers for a deleted account.
 */

const TIMEOUT_MS = 5000
const hash = (/** @type {string} */ token) => createHash('sha256').update(token).digest('hex')

/**
 * Remember answers so dtwin is not asked on every request. Keys are hashes, never tokens.
 * A revoked token keeps working for at most `ttlMs`; a rejected one is retried sooner.
 * @param {Verifier} inner
 * @param {{ ttlMs?: number, negativeTtlMs?: number, maxEntries?: number, now?: () => number }} [options]
 * @returns {Verifier}
 */
export function cachedVerifier(inner, { ttlMs = 300_000, negativeTtlMs = 30_000, maxEntries = 10_000, now = Date.now } = {}) {
  /** @type {Map<string, { until: number, identity: Identity | null }>} */
  const cache = new Map()
  return {
    async verify(token) {
      const key = hash(token)
      const hit = cache.get(key)
      if (hit && hit.until > now()) return hit.identity
      cache.delete(key)
      const identity = await inner.verify(token)
      if (cache.size >= maxEntries) {
        const oldest = cache.keys().next().value
        if (oldest !== undefined) cache.delete(oldest)
      }
      cache.set(key, { identity, until: now() + (identity ? ttlMs : negativeTtlMs) })
      return identity
    },
    forget(userId) {
      for (const [key, hit] of cache) if (hit.identity?.userId === userId) cache.delete(key)
    },
  }
}

/**
 * RFC 7662 introspection with a service token. The token must be active, carry the scope
 * and belong to our client, so a dtwin token issued to something else opens nothing here.
 * @param {{ url: string, serviceToken: string, scope: string, clientId: string, fetch?: typeof fetch }} options
 * @returns {Verifier}
 */
export function introspectionVerifier({ url, serviceToken, scope, clientId, fetch: send = fetch }) {
  return {
    async verify(token) {
      const res = await send(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceToken}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!res.ok) throw new Error(`introspection ${res.status}`)
      const body = /** @type {{ active?: boolean, sub?: unknown, scope?: unknown, client_id?: unknown, telegram?: unknown }} */ (await res.json())
      const sub = typeof body.sub === 'number' ? String(body.sub) : body.sub
      if (body.active !== true || typeof sub !== 'string' || !sub) return null
      if (body.client_id !== clientId) return null
      if (!String(body.scope ?? '').split(' ').includes(scope)) return null
      return typeof body.telegram === 'boolean' ? { userId: sub, telegram: body.telegram } : { userId: sub }
    },
  }
}

/**
 * Ask dtwin who the token belongs to. Weaker than introspection: it cannot check the
 * client or the scope, so it is only for a dtwin endpoint that already enforces both.
 * @param {{ url: string, fetch?: typeof fetch }} options
 * @returns {Verifier}
 */
export function userinfoVerifier({ url, fetch: send = fetch }) {
  return {
    async verify(token) {
      const res = await send(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (res.status === 401 || res.status === 403) return null
      if (!res.ok) throw new Error(`userinfo ${res.status}`)
      const body = /** @type {{ sub?: unknown, id?: unknown }} */ (await res.json())
      const id = body.sub ?? body.id
      return typeof id === 'string' && id ? { userId: id } : null
    },
  }
}

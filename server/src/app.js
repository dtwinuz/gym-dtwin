import { createHash } from 'node:crypto'
import { PROFILE_KIND, readPut } from './validate.js'

export const MAX_BODY = 5 * 1024 * 1024

/**
 * @typedef {import('node:http').IncomingMessage} Req
 * @typedef {import('node:http').ServerResponse} Res
 * @typedef {(entry: Record<string, unknown>) => void} Log
 */

export const jsonLog = /** @type {Log} */ (entry => {
  process.stdout.write(`${JSON.stringify({ t: new Date().toISOString(), ...entry })}\n`)
})

/** Fixed window per key; old windows are dropped as new ones open. */
function limiter(/** @type {number} */ permits, /** @type {number} */ windowMs, /** @type {() => number} */ now) {
  /** @type {Map<string, { count: number, until: number }>} */
  let hits = new Map()
  let sweepAt = 0
  return {
    /** Seconds to wait, or 0 when allowed. */
    take(/** @type {string} */ key) {
      const at = now()
      if (at >= sweepAt) {
        hits = new Map([...hits].filter(([, v]) => v.until > at))
        sweepAt = at + windowMs
      }
      const row = hits.get(key)
      if (!row || row.until <= at) {
        hits.set(key, { count: 1, until: at + windowMs })
        return 0
      }
      row.count++
      return row.count > permits ? Math.ceil((row.until - at) / 1000) : 0
    },
  }
}

class TooLarge extends Error {}

async function readBody(/** @type {Req} */ req, /** @type {number} */ limit) {
  if (Number(req.headers['content-length'] ?? 0) > limit) throw new TooLarge()
  /** @type {Buffer[]} */
  const parts = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw new TooLarge()
    parts.push(chunk)
  }
  return Buffer.concat(parts).toString('utf8')
}

function send(/** @type {Res} */ res, /** @type {number} */ status, /** @type {string | null} */ body, /** @type {Record<string, string>} */ headers = {}) {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...(body == null ? {} : { 'Content-Type': 'application/json; charset=utf-8' }),
    ...headers,
  })
  res.end(body ?? undefined)
}

const fail = (/** @type {Res} */ res, /** @type {number} */ status, /** @type {string} */ code, /** @type {Record<string, string>} */ headers = {}) =>
  send(res, status, JSON.stringify({ error: code }), headers)

const bearer = (/** @type {Req} */ req) => /^Bearer ([^\s]+)$/.exec(req.headers.authorization ?? '')?.[1] ?? null

const ownerOf = (/** @type {string} */ userId) => createHash('sha256').update(userId).digest('hex').slice(0, 16)

/** The stored document is sent as stored, without parsing it again. */
const docBody = (/** @type {{ rev: number, doc: string, updatedAt: number }} */ row, /** @type {string} */ owner) =>
  `{"kind":${JSON.stringify(PROFILE_KIND)},"rev":${row.rev},"updatedAt":${row.updatedAt},"owner":"${owner}","profile":${row.doc}}`

/**
 * The HTTP handler, with everything from outside passed in.
 * @param {{
 *   store: import('./store.js').Store,
 *   verifier: import('./verifier.js').Verifier,
 *   log?: Log,
 *   now?: () => number,
 *   maxBody?: number,
 *   userPermits?: number,
 *   badAuthPermits?: number,
 *   windowMs?: number,
 *   trustProxy?: boolean,
 * }} options
 * @returns {(req: Req, res: Res) => Promise<void>}
 */
export function createHandler({ store, verifier, log = jsonLog, now = Date.now, maxBody = MAX_BODY, userPermits = 120, badAuthPermits = 30, windowMs = 60_000, trustProxy = false }) {
  const users = limiter(userPermits, windowMs, now)
  const badAuth = limiter(badAuthPermits, windowMs, now)

  const clientIp = (/** @type {Req} */ req) => {
    const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',').at(-1)?.trim()
    return (trustProxy && forwarded) || req.socket.remoteAddress || 'unknown'
  }

  /** @param {Req} req @param {Res} res @param {string} owner @param {string} userId */
  async function data(req, res, owner, userId) {
    if (req.method === 'GET') {
      const row = store.get(userId)
      if (!row) return send(res, 404, JSON.stringify({ error: 'not_found', owner }))
      return send(res, 200, docBody(row, owner))
    }
    if (req.method === 'DELETE') {
      store.remove(userId)
      return send(res, 204, null)
    }
    if (req.method !== 'PUT') return fail(res, 405, 'method_not_allowed', { Allow: 'GET, PUT, DELETE' })
    if (!/^application\/json\b/i.test(req.headers['content-type'] ?? '')) return fail(res, 415, 'json_required')

    let parsed
    try {
      parsed = JSON.parse(await readBody(req, maxBody))
    } catch (e) {
      if (e instanceof TooLarge) return fail(res, 413, 'too_large', { Connection: 'close' })
      return fail(res, 400, 'bad_json')
    }
    const put = readPut(parsed)
    if (!put) return fail(res, 400, 'bad_shape')
    const result = store.put(userId, put.baseRev, put.doc)
    if (result.ok) return send(res, 200, JSON.stringify({ rev: result.rev, updatedAt: result.updatedAt, owner }))
    return send(res, 409, result.current ? docBody(result.current, owner) : JSON.stringify({ kind: PROFILE_KIND, rev: 0, profile: null, owner }))
  }

  /** @param {Req} req @param {Res} res @param {(user: string) => void} seen */
  async function route(req, res, seen) {
    const path = (req.url ?? '/').split('?')[0]
    if (path === '/api/health') {
      if (req.method !== 'GET') return fail(res, 405, 'method_not_allowed', { Allow: 'GET' })
      return store.healthy() ? send(res, 200, '{"ok":true}') : fail(res, 503, 'unavailable')
    }
    if (path !== '/api/data') return fail(res, 404, 'not_found')

    const ip = clientIp(req)
    const token = bearer(req)
    const challenge = { 'WWW-Authenticate': 'Bearer' }
    if (!token) {
      const wait = badAuth.take(ip)
      return wait ? fail(res, 429, 'rate_limited', { 'Retry-After': String(wait) }) : fail(res, 401, 'unauthorized', challenge)
    }
    let identity
    try {
      identity = await verifier.verify(token)
    } catch (e) {
      log({ level: 'error', msg: 'verifier', err: e instanceof Error ? e.name : 'unknown' })
      return fail(res, 503, 'auth_unavailable', { 'Retry-After': '30' })
    }
    if (!identity) {
      const wait = badAuth.take(ip)
      return wait ? fail(res, 429, 'rate_limited', { 'Retry-After': String(wait) }) : fail(res, 401, 'unauthorized', challenge)
    }
    const owner = ownerOf(identity.userId)
    seen(owner)
    const wait = users.take(identity.userId)
    if (wait) return fail(res, 429, 'rate_limited', { 'Retry-After': String(wait) })
    return data(req, res, owner, identity.userId)
  }

  return async (req, res) => {
    const started = now()
    let user = ''
    try {
      await route(req, res, owner => { user = owner })
    } catch (e) {
      log({ level: 'error', msg: 'unhandled', err: e instanceof Error ? e.name : 'unknown' })
      if (!res.headersSent) fail(res, 500, 'internal')
      else res.destroy()
    }
    log({ level: 'info', msg: 'request', method: req.method, path: (req.url ?? '').split('?')[0], status: res.statusCode, ms: now() - started, user })
  }
}

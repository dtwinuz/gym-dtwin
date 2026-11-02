import { createServer } from 'node:http'
import { createHandler, jsonLog } from './app.js'
import { openStore } from './store.js'
import { TICK_MS, dtwinBridge, tick } from './bridge.js'
import { cachedVerifier, introspectionVerifier, userinfoVerifier } from './verifier.js'

/** @param {string} name */
function need(name) {
  const v = process.env[name]
  if (!v) {
    jsonLog({ level: 'fatal', msg: 'missing env', name })
    process.exit(1)
  }
  return v
}

function buildVerifier() {
  const mode = process.env.DTWIN_VERIFY_MODE ?? 'introspect'
  if (mode === 'userinfo') return userinfoVerifier({ url: need('DTWIN_USERINFO_URL') })
  return introspectionVerifier({
    url: need('DTWIN_INTROSPECT_URL'),
    serviceToken: need('DTWIN_SERVICE_TOKEN'),
    scope: process.env.DTWIN_REQUIRED_SCOPE ?? 'gym',
    clientId: process.env.DTWIN_CLIENT_ID ?? 'gym-dtwin',
  })
}

const store = openStore(process.env.DB_PATH ?? '/data/gym.sqlite')
const handler = createHandler({
  store,
  verifier: cachedVerifier(buildVerifier()),
  trustProxy: process.env.TRUST_PROXY === '1',
  serviceToken: process.env.DTWIN_SERVICE_TOKEN ?? '',
})

const server = createServer((req, res) => void handler(req, res))
server.requestTimeout = 30_000
server.headersTimeout = 10_000
server.keepAliveTimeout = 5_000

const port = Number(process.env.PORT ?? 8080)
server.listen(port, () => jsonLog({ level: 'info', msg: 'listening', port }))

const bridgeUrl = process.env.DTWIN_BRIDGE_URL
let ticking = false
const runTick = async () => {
  if (ticking || !bridgeUrl) return
  ticking = true
  try {
    const stats = await tick({ store, bridge: dtwinBridge({ baseUrl: bridgeUrl, serviceToken: need('DTWIN_SERVICE_TOKEN') }), log: jsonLog })
    if (stats.reminders || stats.weekly || stats.diary || stats.errors) jsonLog({ level: 'info', msg: 'bridge', ...stats })
  } catch (e) {
    jsonLog({ level: 'error', msg: 'bridge tick', err: e instanceof Error ? e.name : 'unknown' })
  } finally {
    ticking = false
  }
}
const timers = bridgeUrl ? [setTimeout(runTick, 30_000), setInterval(runTick, TICK_MS)] : []
if (bridgeUrl) jsonLog({ level: 'info', msg: 'bridge on', everyMs: TICK_MS })

function shutdown() {
  for (const t of timers) clearTimeout(t)
  server.close(() => {
    store.close()
    process.exit(0)
  })
  server.closeIdleConnections()
  setTimeout(() => process.exit(0), 10_000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

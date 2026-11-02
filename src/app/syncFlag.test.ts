// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const ROOT = join(__dirname, '..')

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('VITE_SYNC_ENABLED off (the default)', () => {
  it('only the exact value turns it on', async () => {
    vi.stubEnv('VITE_SYNC_ENABLED', '1')
    const store = await import('./store')
    store.updateSettings({ theme: 'light' })
    expect(store.getProfile().stamps).toBeUndefined()
  })

  it('starting the app and changing data makes no network call to /api or to dtwin', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
      calls.push(String(url))
      return new Response('{}', { status: 200 })
    }))
    document.body.innerHTML = '<div id="root"></div>'
    location.hash = '#/settings'
    await import('../main')
    const store = await import('./store')
    store.updateSettings({ theme: 'dark' })
    store.updateProfile(p => ({ ...p, targetW: 70 }))
    await new Promise(res => setTimeout(res, 300))
    expect(calls.filter(u => u.includes('/api') || u.includes('/oauth'))).toEqual([])
  })

  it('writes no sync stamps into the stored profile', async () => {
    const store = await import('./store')
    store.updateSettings({ theme: 'light' })
    expect(store.getProfile().stamps).toBeUndefined()
  })

  // Written out at each use: only then can the bundler drop the branch and its chunks.
  it('every sync module is reached only through an inline flag check', () => {
    const flag = "import.meta.env.VITE_SYNC_ENABLED === 'true'"
    expect(readFileSync(join(ROOT, 'main.tsx'), 'utf8')).toContain(`if (${flag}) {`)
    expect(readFileSync(join(ROOT, 'App.tsx'), 'utf8')).toContain(`${flag} ? lazy(() => import('./app/SyncBanner'))`)
    const settings = readFileSync(join(ROOT, 'pages/Settings.tsx'), 'utf8')
    expect(settings).toContain(`${flag} ? lazy(() => import('./settings/Account'))`)
    expect(settings).toContain(`${flag} ? lazy(() => import('./settings/Reminders'))`)
    expect(readFileSync(join(ROOT, 'app/store.ts'), 'utf8')).toContain(`${flag} ? stampChanges`)
  })
})

describe('VITE_SYNC_ENABLED on', () => {
  it('the store stamps local changes', async () => {
    vi.stubEnv('VITE_SYNC_ENABLED', 'true')
    const store = await import('./store')
    store.updateSettings({ theme: 'dark' })
    expect(store.getProfile().stamps?.['settings.theme']).toBe(store.getProfile().updatedAt)
  })

  it('a guest makes no network call', async () => {
    vi.stubEnv('VITE_SYNC_ENABLED', 'true')
    vi.stubEnv('VITE_DTWIN_ISSUER', 'https://id.test')
    const fetcher = vi.fn(async () => new Response('{}'))
    vi.stubGlobal('fetch', fetcher)
    const boot = await import('./syncBoot')
    await boot.startSync()
    const store = await import('./store')
    store.updateProfile(p => ({ ...p, targetW: 71 }))
    await new Promise(res => setTimeout(res, 50))
    expect(fetcher).not.toHaveBeenCalled()
    expect(boot.engine.state().status).toBe('guest')
  })
})

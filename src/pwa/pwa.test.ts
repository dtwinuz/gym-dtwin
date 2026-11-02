import { describe, expect, it, vi } from 'vitest'
import { NAV_DENYLIST, isApi, isExerciseImage, isFontCss, isFontFile } from './routes'
import { createUpdatePrompt } from './prompt'

const ORIGIN = 'https://gym.dtwin.uz'
const at = (href: string) => {
  const url = new URL(href, ORIGIN)
  return { url, sameOrigin: url.origin === ORIGIN }
}
const denied = (path: string) => NAV_DENYLIST.some(r => r.test(path))

describe('service worker routes', () => {
  it('caches only our own exercise images', () => {
    expect(isExerciseImage(at('/ex/Air_Bike/0.webp'))).toBe(true)
    expect(isExerciseImage(at('https://dtwin.uz/ex/Air_Bike/0.webp'))).toBe(false)
    expect(isExerciseImage(at('/assets/ex-123.js'))).toBe(false)
  })

  it('keeps the API on the network and ignores dtwin.uz', () => {
    expect(isApi(at('/api/profile'))).toBe(true)
    expect(isApi(at('https://dtwin.uz/api/profile'))).toBe(false)
    const widget = at('https://dtwin.uz/support/widget.js')
    expect([isApi, isExerciseImage, isFontCss, isFontFile].some(f => f(widget))).toBe(false)
  })

  it('matches font hosts by origin', () => {
    expect(isFontCss(at('https://fonts.googleapis.com/css2?family=Inter'))).toBe(true)
    expect(isFontFile(at('https://fonts.gstatic.com/s/inter/v1/a.woff2'))).toBe(true)
    expect(isFontFile(at('https://evil.test/fonts.gstatic.com/a.woff2'))).toBe(false)
  })

  it('serves the shell for app paths and the auth callback only', () => {
    expect(denied('/')).toBe(false)
    expect(denied('/auth/callback')).toBe(false)
    expect(denied('/api/profile')).toBe(true)
    expect(denied('/overview/')).toBe(true)
    expect(denied('/overview')).toBe(true)
    expect(denied('/overview/ru/')).toBe(true)
    expect(denied('/deck/konsept.html')).toBe(true)
    expect(denied('/ex/Air_Bike/0.webp')).toBe(true)
    expect(denied('/overviewer')).toBe(false)
  })
})

describe('update prompt', () => {
  const setup = (busy: boolean) => {
    const state = { busy }
    const listeners = new Set<() => void>()
    const show = vi.fn()
    const prompt = createUpdatePrompt({
      busy: () => state.busy,
      subscribe: cb => { listeners.add(cb); return () => { listeners.delete(cb) } },
      show,
    })
    const change = (next: boolean) => { state.busy = next; listeners.forEach(l => l()) }
    return { prompt, show, change, listeners }
  }

  it('shows nothing until an update is waiting', () => {
    const { show, change } = setup(false)
    change(false)
    expect(show).not.toHaveBeenCalled()
  })

  it('shows at once when no workout is running', () => {
    const { prompt, show, listeners } = setup(false)
    prompt.ready()
    expect(show).toHaveBeenCalledTimes(1)
    expect(listeners.size).toBe(0)
  })

  it('waits for the active workout to end, then shows once', () => {
    const { prompt, show, change, listeners } = setup(true)
    prompt.ready()
    expect(show).not.toHaveBeenCalled()
    change(true)
    expect(show).not.toHaveBeenCalled()
    change(false)
    expect(show).toHaveBeenCalledTimes(1)
    expect(listeners.size).toBe(0)
    prompt.ready()
    change(false)
    expect(show).toHaveBeenCalledTimes(1)
  })
})

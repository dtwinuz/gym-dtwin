import { useEffect, useState } from 'react'
import type { Settings } from '../core/types'
import { accentTokens, THEME_BG } from './color'

const query = () => (typeof matchMedia === 'undefined' ? null : matchMedia('(prefers-color-scheme: light)'))

export function useSystemLight() {
  const [light, setLight] = useState(() => query()?.matches ?? false)
  useEffect(() => {
    const mq = query()
    if (!mq) return
    const on = () => setLight(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return light
}

export function resolveTheme(theme: Settings['theme'], systemLight: boolean): 'dark' | 'light' {
  return theme === 'system' ? (systemLight ? 'light' : 'dark') : theme
}

export function useApplyTheme(s: Pick<Settings, 'theme' | 'accent' | 'lang'>, active: boolean) {
  const systemLight = useSystemLight()
  const mode = resolveTheme(s.theme, systemLight)
  useEffect(() => {
    const root = document.documentElement
    root.lang = s.lang
    if (!active) return
    const { accent, ink } = accentTokens(s.accent, mode)
    root.dataset.theme = mode
    root.style.setProperty('--accent', accent)
    root.style.setProperty('--accent-ink', ink)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BG[mode])
    return () => {
      delete root.dataset.theme
      root.style.removeProperty('--accent')
      root.style.removeProperty('--accent-ink')
    }
  }, [mode, s.accent, s.lang, active])
  return mode
}

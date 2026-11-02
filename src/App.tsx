import { lazy, Suspense, useEffect, useState } from 'react'
import { BarChart3, CalendarDays, Dumbbell, Home as HomeIcon, Settings as SettingsIcon, Timer } from 'lucide-react'
import { LANGS, t, type Key } from './i18n'
import { updateProfile, updateSettings, useProfile } from './app/store'
import { useApplyTheme } from './app/theme'
import Toaster from './app/Toaster'
import SafetyNotice from './app/SafetyNotice'

const Landing = lazy(() => import('./landing/Landing'))
const Home = lazy(() => import('./pages/Home'))
const Plan = lazy(() => import('./pages/Plan'))
const Workout = lazy(() => import('./pages/Workout'))
const Progress = lazy(() => import('./pages/Progress'))
const Exercises = lazy(() => import('./pages/Exercises'))
const Settings = lazy(() => import('./pages/Settings'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const SyncBanner = import.meta.env.VITE_SYNC_ENABLED === 'true' ? lazy(() => import('./app/SyncBanner')) : null

const ROUTES = [
  { path: '/home', key: 'home', icon: HomeIcon, page: Home },
  { path: '/plan', key: 'plan', icon: CalendarDays, page: Plan },
  { path: '/workout', key: 'workout', icon: Timer, page: Workout },
  { path: '/exercises', key: 'exercises', icon: Dumbbell, page: Exercises },
  { path: '/progress', key: 'progress', icon: BarChart3, page: Progress },
] satisfies { path: string; key: Key; icon: unknown; page: unknown }[]

// '' and '#/' open the landing page; the app lives under '#/home', '#/plan', ...
const currentPath = () => (location.hash.slice(1) || '/').split('?')[0]
const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`)

export default function App() {
  const { settings, routines, onboardedAt } = useProfile()
  const { lang } = settings
  const [path, setPath] = useState(currentPath)
  const [safetyLater, setSafetyLater] = useState(false)
  const landing = path === '/'
  useApplyTheme(settings, !landing)

  useEffect(() => {
    const onHash = () => {
      const next = currentPath()
      setPath(prev => {
        if (prev.split('/')[1] !== next.split('/')[1]) window.scrollTo(0, 0)
        return next
      })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (landing) {
    return (
      <Suspense fallback={<div className="landing-boot" />}>
        <Landing />
      </Suspense>
    )
  }

  const isSettings = under(path, '/settings')
  const route = isSettings ? null : ROUTES.find(r => under(path, r.path)) ?? ROUTES[0]
  const Page = route ? route.page : Settings
  const topLevel = path.split('/').length <= 2
  const showSafety = settings.safetyAck == null && !safetyLater && topLevel
  const showOnboarding = !showSafety && topLevel && routines.length === 0 && onboardedAt == null && (path === '/home' || path === '/plan')

  return (
    <div className="app">
      <header className="topbar">
        <a href="#/" className="brand" title="gym.dtwin"><Dumbbell size={20} /><b>gym<span>.dtwin</span></b></a>
        <nav className="topnav" aria-label="gym.dtwin">
          {ROUTES.map(r => (
            <a key={r.path} href={`#${r.path}`} className={r === route ? 'on' : ''} aria-current={r === route ? 'page' : undefined}>{t(lang, r.key)}</a>
          ))}
        </nav>
        <div className="top-actions">
          <div className="langs">
            {LANGS.map(l => (
              <button key={l} className={l === lang ? 'on' : ''} aria-pressed={l === lang} onClick={() => updateSettings({ lang: l })}>{l}</button>
            ))}
          </div>
          <a
            href="#/settings" className={`icon-btn${isSettings ? ' on' : ''}`} aria-label={t(lang, 'settings')} title={t(lang, 'settings')}
            aria-current={isSettings ? 'page' : undefined}
          >
            <SettingsIcon size={20} />
          </a>
        </div>
      </header>
      {SyncBanner && <Suspense fallback={null}><SyncBanner /></Suspense>}
      <main className="page"><Suspense fallback={null}><Page /></Suspense></main>
      <nav className="tabbar" aria-label="gym.dtwin">
        {ROUTES.map(r => (
          <a key={r.path} href={`#${r.path}`} className={r === route ? 'on' : ''} aria-current={r === route ? 'page' : undefined}>
            <r.icon size={20} />
            <span>{t(lang, r.key)}</span>
          </a>
        ))}
      </nav>
      <Toaster />
      {showSafety && <SafetyNotice onClose={() => setSafetyLater(true)} />}
      {showOnboarding && (
        <Suspense fallback={null}>
          <Onboarding onClose={() => updateProfile(p => ({ ...p, onboardedAt: p.onboardedAt ?? Date.now() }))} />
        </Suspense>
      )}
    </div>
  )
}

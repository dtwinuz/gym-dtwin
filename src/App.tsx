import { lazy, Suspense, useEffect, useState } from 'react'
import { BarChart3, CalendarDays, Dumbbell, Home as HomeIcon, Timer } from 'lucide-react'
import { LANGS, t, type Key } from './i18n'
import { update, useStore } from './store'
import Home from './pages/Home'
import Plan from './pages/Plan'
import Exercises from './pages/Exercises'
import Workout from './pages/Workout'
import Progress from './pages/Progress'

const Landing = lazy(() => import('./landing/Landing'))

const ROUTES = [
  { path: '/home', key: 'home', icon: HomeIcon, page: Home },
  { path: '/plan', key: 'plan', icon: CalendarDays, page: Plan },
  { path: '/workout', key: 'workout', icon: Timer, page: Workout },
  { path: '/exercises', key: 'exercises', icon: Dumbbell, page: Exercises },
  { path: '/progress', key: 'progress', icon: BarChart3, page: Progress },
] satisfies { path: string; key: Key; icon: unknown; page: unknown }[]

// '' and '#/' open the landing page; the app lives under '#/home', '#/plan', ...
const currentPath = () => location.hash.slice(1) || '/'

export default function App() {
  const { lang } = useStore()
  const [path, setPath] = useState(currentPath)

  useEffect(() => {
    const onHash = () => {
      setPath(currentPath())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (path === '/') {
    return (
      <Suspense fallback={<div className="landing-boot" />}>
        <Landing />
      </Suspense>
    )
  }

  const route = ROUTES.find(r => r.path === path) ?? ROUTES[0]
  const Page = route.page

  return (
    <div className="app">
      <header className="topbar">
        <a href="#/" className="brand" title="gym.dtwin"><Dumbbell size={20} /><b>gym<span>.dtwin</span></b></a>
        <nav className="topnav">
          {ROUTES.map(r => (
            <a key={r.path} href={`#${r.path}`} className={r === route ? 'on' : ''}>{t(lang, r.key)}</a>
          ))}
        </nav>
        <div className="langs">
          {LANGS.map(l => (
            <button key={l} className={l === lang ? 'on' : ''} onClick={() => update(s => ({ ...s, lang: l }))}>{l}</button>
          ))}
        </div>
      </header>
      <main className="page"><Page /></main>
      <nav className="tabbar">
        {ROUTES.map(r => (
          <a key={r.path} href={`#${r.path}`} className={r === route ? 'on' : ''}>
            <r.icon size={20} />
            <span>{t(lang, r.key)}</span>
          </a>
        ))}
      </nav>
    </div>
  )
}

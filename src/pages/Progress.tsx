import { useEffect } from 'react'
import { t, type Key } from '../i18n'
import { useCustomExercises } from '../app/routineMap'
import { useProfile } from '../app/store'
import Body from './progress/Body'
import History from './progress/History'
import Muscles from './progress/Muscles'
import Stats from './progress/Stats'
import Strength from './progress/Strength'

const TABS: { slug: string; key: Key }[] = [
  { slug: '', key: 'tabStats' },
  { slug: 'muscles', key: 'tabMuscles' },
  { slug: 'strength', key: 'tabStrength' },
  { slug: 'history', key: 'history' },
  { slug: 'body', key: 'tabBody' },
]

export default function Progress() {
  const p = useProfile()
  const { lang } = p.settings
  useCustomExercises(p.customEx)
  const asked = location.hash.slice(1).split('?')[0].split('/')[2] ?? ''
  const tab = TABS.some(x => x.slug === asked) ? asked : ''

  useEffect(() => { window.scrollTo(0, 0) }, [tab])

  return (
    <>
      <h1>{t(lang, 'progress')}</h1>
      <nav className="tabs tabs-scroll" aria-label={t(lang, 'progress')}>
        {TABS.map(x => (
          <a key={x.slug} href={x.slug ? `#/progress/${x.slug}` : '#/progress'} className={x.slug === tab ? 'on' : ''} aria-current={x.slug === tab ? 'page' : undefined}>{t(lang, x.key)}</a>
        ))}
      </nav>
      {tab === '' && <Stats p={p} />}
      {tab === 'muscles' && <Muscles p={p} />}
      {tab === 'strength' && <Strength p={p} />}
      {tab === 'history' && <History p={p} />}
      {tab === 'body' && <Body p={p} />}
    </>
  )
}

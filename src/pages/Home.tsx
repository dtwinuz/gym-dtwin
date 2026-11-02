import { Flame, Trophy, Weight } from 'lucide-react'
import { t } from '../i18n'
import { useProfile } from '../app/store'
import { starterDay, starterExName, starterPlan } from '../app/starter'
import { fmtDate, fmtNum } from '../app/format'
import { addDays, isoDate, setsDone, sortByStart } from '../core/history'

export default function Home() {
  const p = useProfile()
  const { lang, unit } = p.settings
  const { workouts } = p
  const plan = starterPlan(p)
  const day = starterDay(p)

  const weekAgo = addDays(isoDate(new Date()), -7)
  const thisWeek = workouts.filter(w => w.date >= weekAgo).length
  const volume = workouts.reduce((sum, w) => sum + w.vol, 0)
  const recent = sortByStart(workouts).slice(-5).reverse()

  return (
    <>
      <section className="hero card">
        <p className="muted">{plan.name}</p>
        <h1>{t(lang, 'today')}: {day.name}</h1>
        <ul className="list">
          {day.items.map(i => (
            <li key={i.exId}>
              <span>{starterExName(i.exId, lang)}</span>
              <span className="muted">{i.sets} × {i.reps}</span>
            </li>
          ))}
        </ul>
        <a className="btn primary" href="#/workout">{t(lang, 'start')}</a>
      </section>

      <section className="stats">
        <div className="card stat"><Flame size={18} /><b>{thisWeek}</b><span>{t(lang, 'thisWeek')}</span></div>
        <div className="card stat"><Trophy size={18} /><b>{workouts.length}</b><span>{t(lang, 'total')}</span></div>
        <div className="card stat"><Weight size={18} /><b>{fmtNum(volume / 1000, lang)} {unit === 'kg' ? 't' : 'k lb'}</b><span>{t(lang, 'volume')}</span></div>
      </section>

      <section className="card">
        <h2>{t(lang, 'history')}</h2>
        {workouts.length === 0 && <p className="muted">{t(lang, 'empty')}</p>}
        <ul className="list">
          {recent.map(w => (
            <li key={w.id}>
              <span>{w.name}</span>
              <span className="muted">{fmtDate(w.date, lang)} · {setsDone(w.entries)} {t(lang, 'setsShort')}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2>{t(lang, 'decks')}</h2>
        <p className="muted">{t(lang, 'decksText')}</p>
        <div className="row wrap">
          <a className="btn" href={lang === 'uz' ? '/overview/' : `/overview/${lang}/`}>{t(lang, 'overviewLink')}</a>
          <a className="btn" href="/deck/tadqiqot.html" target="_blank" rel="noopener">{t(lang, 'deckResearch')}</a>
          <a className="btn primary" href="/deck/konsept.html" target="_blank" rel="noopener">{t(lang, 'deckConcept')}</a>
        </div>
      </section>
    </>
  )
}

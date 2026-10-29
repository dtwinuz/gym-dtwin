import { Flame, Trophy, Weight } from 'lucide-react'
import { exerciseById, planById } from '../data'
import { t } from '../i18n'
import { nextDay, useStore } from '../store'

export default function Home() {
  const { lang, planId, workouts } = useStore()
  const plan = planById(planId)
  const day = nextDay(planId, workouts.filter(w => w.planId === planId).length)

  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)
  const thisWeek = workouts.filter(w => w.date >= weekAgo).length
  const volume = workouts.reduce((sum, w) => sum + w.sets.reduce((a, s) => a + s.kg * s.reps, 0), 0)

  return (
    <>
      <section className="hero card">
        <p className="muted">{plan.name}</p>
        <h1>{t(lang, 'today')}: {day.name}</h1>
        <ul className="list">
          {day.items.map(i => (
            <li key={i.exId}>
              <span>{exerciseById(i.exId)?.name}</span>
              <span className="muted">{i.sets} × {i.reps}</span>
            </li>
          ))}
        </ul>
        <a className="btn primary" href="#/workout">{t(lang, 'start')}</a>
      </section>

      <section className="stats">
        <div className="card stat"><Flame size={18} /><b>{thisWeek}</b><span>{t(lang, 'thisWeek')}</span></div>
        <div className="card stat"><Trophy size={18} /><b>{workouts.length}</b><span>{t(lang, 'total')}</span></div>
        <div className="card stat"><Weight size={18} /><b>{Math.round(volume / 1000)} t</b><span>{t(lang, 'volume')}</span></div>
      </section>

      <section className="card">
        <h2>{t(lang, 'history')}</h2>
        {workouts.length === 0 && <p className="muted">{t(lang, 'empty')}</p>}
        <ul className="list">
          {workouts.slice(-5).reverse().map(w => (
            <li key={w.id}>
              <span>{w.dayName}</span>
              <span className="muted">{w.date} · {w.sets.length} set</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2>{t(lang, 'decks')}</h2>
        <p className="muted">{t(lang, 'decksText')}</p>
        <div className="row">
          <a className="btn" href="/deck/tadqiqot.html" target="_blank" rel="noopener">{t(lang, 'deckResearch')}</a>
          <a className="btn primary" href="/deck/konsept.html" target="_blank" rel="noopener">{t(lang, 'deckConcept')}</a>
        </div>
      </section>
    </>
  )
}

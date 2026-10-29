import { exerciseById, PLANS } from '../data'
import { t } from '../i18n'
import { update, useStore } from '../store'

export default function Plan() {
  const { lang, planId } = useStore()

  return (
    <>
      <h1>{t(lang, 'plan')}</h1>
      <div className="grid">
        {PLANS.map(p => (
          <section key={p.id} className={`card plan ${p.id === planId ? 'active' : ''}`}>
            <header>
              <div>
                <h2>{p.name}</h2>
                <p className="muted">{p.note}</p>
              </div>
              {p.id === planId
                ? <span className="badge">{t(lang, 'active')}</span>
                : <button className="btn" onClick={() => update(s => ({ ...s, planId: p.id }))}>{t(lang, 'choose')}</button>}
            </header>
            {p.days.map(d => (
              <div key={d.name} className="day">
                <h3>{d.name}</h3>
                <p className="muted">{d.items.map(i => `${exerciseById(i.exId)?.name} ${i.sets}×${i.reps}`).join(' · ')}</p>
              </div>
            ))}
          </section>
        ))}
      </div>
    </>
  )
}

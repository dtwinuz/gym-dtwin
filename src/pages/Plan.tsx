import { PLANS } from '../data'
import { t } from '../i18n'
import { updateProfile, useProfile } from '../app/store'
import { starterExName, starterPlan } from '../app/starter'

export default function Plan() {
  const p = useProfile()
  const { lang } = p.settings
  const planId = starterPlan(p).id

  return (
    <>
      <h1>{t(lang, 'plan')}</h1>
      <div className="grid">
        {PLANS.map(plan => (
          <section key={plan.id} className={`card plan ${plan.id === planId ? 'active' : ''}`}>
            <header>
              <div>
                <h2>{plan.name}</h2>
                <p className="muted">{t(lang, plan.note)}</p>
              </div>
              {plan.id === planId
                ? <span className="badge">{t(lang, 'active')}</span>
                : <button className="btn" onClick={() => updateProfile(x => ({ ...x, planId: plan.id }))}>{t(lang, 'choose')}</button>}
            </header>
            {plan.days.map(d => (
              <div key={d.name} className="day">
                <h3>{d.name}</h3>
                <p className="muted">{d.items.map(i => `${starterExName(i.exId, lang)} ${i.sets}×${i.reps}`).join(' · ')}</p>
              </div>
            ))}
          </section>
        ))}
      </div>
    </>
  )
}

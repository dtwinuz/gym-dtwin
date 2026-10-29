import { useState } from 'react'
import { EXERCISES, MUSCLES, type Muscle } from '../data'
import { muscleName, t } from '../i18n'
import { bestE1rm, useStore } from '../store'

export default function Exercises() {
  const { lang, workouts } = useStore()
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<Muscle | null>(null)

  const list = EXERCISES.filter(e =>
    (!muscle || e.muscle === muscle) && e.name.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <>
      <h1>{t(lang, 'exercises')}</h1>
      <input className="input" placeholder={t(lang, 'search')} value={q} onChange={e => setQ(e.target.value)} />
      <div className="chips">
        <button className={!muscle ? 'on' : ''} onClick={() => setMuscle(null)}>{t(lang, 'all')}</button>
        {MUSCLES.map(m => (
          <button key={m} className={m === muscle ? 'on' : ''} onClick={() => setMuscle(m)}>{muscleName[m][lang]}</button>
        ))}
      </div>
      <div className="grid small">
        {list.map(e => {
          const best = bestE1rm(workouts, e.id)
          return (
            <div key={e.id} className="card exercise">
              <span className={`dot m-${e.muscle}`} />
              <div>
                <b>{e.name}</b>
                <p className="muted">{muscleName[e.muscle][lang]} · {e.equipment}</p>
              </div>
              {best > 0 && <span className="badge">{Math.round(best)} kg</span>}
            </div>
          )
        })}
      </div>
    </>
  )
}

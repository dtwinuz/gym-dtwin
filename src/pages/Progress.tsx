import { useState } from 'react'
import { EXERCISES } from '../data'
import { t } from '../i18n'
import { bestE1rm, today, update, useStore } from '../store'

const WEEKS = 12

function Heatmap({ dates }: { dates: Set<string> }) {
  const start = new Date()
  start.setDate(start.getDate() - (WEEKS * 7 - 1))
  const cells = Array.from({ length: WEEKS * 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
  return (
    <div className="heatmap">
      {cells.map(d => <span key={d} title={d} className={dates.has(d) ? 'on' : ''} />)}
    </div>
  )
}

function WeightChart({ points, goal }: { points: { date: string; kg: number }[]; goal: number }) {
  if (points.length < 2) return null
  const values = [...points.map(p => p.kg), goal]
  const min = Math.min(...values) - 1
  const max = Math.max(...values) + 1
  const x = (i: number) => (i / (points.length - 1)) * 300
  const y = (kg: number) => 100 - ((kg - min) / (max - min)) * 100
  return (
    <svg viewBox="0 0 300 100" className="chart" preserveAspectRatio="none">
      <line x1="0" x2="300" y1={y(goal)} y2={y(goal)} className="goal" />
      <polyline points={points.map((p, i) => `${x(i)},${y(p.kg)}`).join(' ')} />
    </svg>
  )
}

export default function Progress() {
  const { lang, workouts, bodyWeight, goalKg } = useStore()
  const [kg, setKg] = useState('')

  const records = EXERCISES
    .map(e => ({ e, best: bestE1rm(workouts, e.id) }))
    .filter(r => r.best > 0)
    .sort((a, b) => b.best - a.best)

  const addWeight = () => {
    const v = Number(kg)
    if (!v) return
    update(s => ({ ...s, bodyWeight: [...s.bodyWeight.filter(b => b.date !== today()), { date: today(), kg: v }] }))
    setKg('')
  }

  return (
    <>
      <h1>{t(lang, 'progress')}</h1>

      <section className="card">
        <h2>{t(lang, 'activity')}</h2>
        <Heatmap dates={new Set(workouts.map(w => w.date))} />
      </section>

      <section className="card">
        <h2>{t(lang, 'records')}</h2>
        {records.length === 0 && <p className="muted">{t(lang, 'empty')}</p>}
        <ul className="list">
          {records.map(r => (
            <li key={r.e.id}><span>{r.e.name}</span><b>{Math.round(r.best)} kg</b></li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>{t(lang, 'bodyWeight')} <span className="muted">· {t(lang, 'goal')} {goalKg} kg</span></h2>
        <WeightChart points={bodyWeight} goal={goalKg} />
        <div className="row">
          <input className="input" type="number" inputMode="decimal" placeholder="kg" value={kg} onChange={e => setKg(e.target.value)} />
          <button className="btn" onClick={addWeight}>{t(lang, 'add')}</button>
        </div>
        <ul className="list">
          {bodyWeight.slice(-5).reverse().map(b => <li key={b.date}><span>{b.date}</span><b>{b.kg} kg</b></li>)}
        </ul>
      </section>
    </>
  )
}

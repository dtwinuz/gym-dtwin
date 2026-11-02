import { useMemo, useState } from 'react'
import { t } from '../i18n'
import { updateProfile, useProfile } from '../app/store'
import { fmtDate, fmtNum } from '../app/format'
import { bestE1rm, exerciseHistory, isoDate } from '../core/history'
import { exerciseById, exerciseName } from '../catalogue'

const WEEKS = 12

function Heatmap({ dates }: { dates: Set<string> }) {
  const start = new Date()
  start.setDate(start.getDate() - (WEEKS * 7 - 1))
  const cells = Array.from({ length: WEEKS * 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return isoDate(d)
  })
  return (
    <div className="heatmap">
      {cells.map(d => <span key={d} title={d} className={dates.has(d) ? 'on' : ''} />)}
    </div>
  )
}

function WeightChart({ points, goal }: { points: { date: string; w: number }[]; goal: number | null }) {
  if (points.length < 2) return null
  const values = [...points.map(p => p.w), ...(goal == null ? [] : [goal])]
  const min = Math.min(...values) - 1
  const max = Math.max(...values) + 1
  const x = (i: number) => (i / (points.length - 1)) * 300
  const y = (w: number) => 100 - ((w - min) / (max - min)) * 100
  return (
    <svg viewBox="0 0 300 100" className="chart" preserveAspectRatio="none">
      {goal != null && <line x1="0" x2="300" y1={y(goal)} y2={y(goal)} className="goal" />}
      <polyline points={points.map((p, i) => `${x(i)},${y(p.w)}`).join(' ')} />
    </svg>
  )
}

export default function Progress() {
  const { settings: { lang, unit, oneRmFormula }, workouts, bodyweight, targetW } = useProfile()
  const [kg, setKg] = useState('')

  const records = useMemo(() => {
    const ids = [...new Set(workouts.flatMap(w => w.entries.map(e => e.exId)))]
    return ids
      .map(id => ({ id, best: bestE1rm(exerciseHistory(workouts, id), oneRmFormula) }))
      .filter(r => r.best > 0)
      .sort((a, b) => b.best - a.best)
  }, [workouts, oneRmFormula])

  const weights = useMemo(() => [...bodyweight].sort((a, b) => a.t - b.t), [bodyweight])

  const addWeight = () => {
    const v = Number(kg)
    if (!v) return
    const date = isoDate(new Date())
    updateProfile(p => ({ ...p, bodyweight: [...p.bodyweight.filter(b => b.date !== date), { date, w: v, t: Date.now() }] }))
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
            <li key={r.id}><span>{exerciseName(exerciseById(r.id), lang)}</span><b>{fmtNum(r.best, lang, 0)} {unit}</b></li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>{t(lang, 'bodyWeight')} {targetW != null && <span className="muted">· {t(lang, 'goal')} {fmtNum(targetW, lang)} {unit}</span>}</h2>
        <WeightChart points={weights} goal={targetW} />
        <div className="row">
          <input className="input" type="number" inputMode="decimal" placeholder={unit} value={kg} onChange={e => setKg(e.target.value)} aria-label={t(lang, 'bodyWeight')} />
          <button className="btn" onClick={addWeight}>{t(lang, 'add')}</button>
        </div>
        <ul className="list">
          {weights.slice(-5).reverse().map(b => <li key={b.date}><span>{fmtDate(b.date, lang)}</span><b>{fmtNum(b.w, lang)} {unit}</b></li>)}
        </ul>
      </section>
    </>
  )
}

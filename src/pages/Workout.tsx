import { useEffect, useState } from 'react'
import { Check, Trophy } from 'lucide-react'
import { exerciseById, planById } from '../data'
import { t } from '../i18n'
import { bestE1rm, e1rm, lastSet, nextDay, today, update, useStore, type LoggedSet } from '../store'

interface Row extends LoggedSet {
  done: boolean
}

const REST_SECONDS = 90

export default function Workout() {
  const { lang, planId, workouts } = useStore()
  const day = nextDay(planId, workouts.filter(w => w.planId === planId).length)

  const [rows, setRows] = useState<Row[]>(() =>
    day.items.flatMap(i => {
      const prev = lastSet(workouts, i.exId)
      return Array.from({ length: i.sets }, () => ({ exId: i.exId, kg: prev?.kg ?? 20, reps: i.reps, done: false }))
    }))
  const [restLeft, setRestLeft] = useState(0)

  useEffect(() => {
    if (restLeft <= 0) return
    const id = setTimeout(() => setRestLeft(r => r - 1), 1000)
    return () => clearTimeout(id)
  }, [restLeft])

  const set = (idx: number, patch: Partial<Row>) =>
    setRows(rs => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)))

  const toggle = (idx: number) => {
    const done = !rows[idx].done
    set(idx, { done })
    if (done) setRestLeft(REST_SECONDS)
  }

  const finish = () => {
    const sets = rows.filter(r => r.done).map(({ exId, kg, reps }) => ({ exId, kg, reps }))
    if (sets.length === 0) return
    update(s => ({
      ...s,
      workouts: [...s.workouts, { id: crypto.randomUUID(), date: today(), planId, dayName: day.name, sets }],
    }))
    location.hash = '#/progress'
  }

  return (
    <>
      <h1>{t(lang, 'workout')}: {day.name}</h1>
      <p className="muted">{planById(planId).name}</p>

      {day.items.map(item => (
        <section key={item.exId} className="card">
          <h2>{exerciseById(item.exId)?.name}</h2>
          {rows.map((r, idx) => {
            if (r.exId !== item.exId) return null
            const isPr = r.done && e1rm(r.kg, r.reps) > bestE1rm(workouts, r.exId) && workouts.length > 0
            return (
              <div key={idx} className={`set ${r.done ? 'done' : ''}`}>
                <input type="number" inputMode="decimal" value={r.kg} onChange={e => set(idx, { kg: Number(e.target.value) })} />
                <span>kg ×</span>
                <input type="number" inputMode="numeric" value={r.reps} onChange={e => set(idx, { reps: Number(e.target.value) })} />
                {isPr && <Trophy size={16} className="pr" />}
                <button className="check" onClick={() => toggle(idx)} aria-label="done"><Check size={18} /></button>
              </div>
            )
          })}
        </section>
      ))}

      <div className="sticky-bar">
        <span className="muted">{restLeft > 0 ? `${t(lang, 'rest')}: ${restLeft}s` : `${rows.filter(r => r.done).length}/${rows.length}`}</span>
        <button className="btn primary" onClick={finish}>{t(lang, 'finish')}</button>
      </div>
    </>
  )
}

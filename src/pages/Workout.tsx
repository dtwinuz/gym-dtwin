import { useEffect, useState } from 'react'
import { Check, Trophy } from 'lucide-react'
import { t } from '../i18n'
import { upsert, useProfile } from '../app/store'
import { legacyExId } from '../app/legacy'
import { lastWorkSet, starterDay, starterExName, starterPlan } from '../app/starter'
import { bestE1rm, detectRecords, exerciseHistory, isoDate, workoutVolume } from '../core/history'
import { e1rm } from '../core/onerm'
import type { Entry } from '../core/types'

interface Row {
  exId: string
  w: number
  r: number
  done: boolean
}

export default function Workout() {
  const p = useProfile()
  const { lang, unit, restSec, oneRmFormula } = p.settings
  const { workouts } = p
  const plan = starterPlan(p)
  const day = starterDay(p)
  const [start] = useState(() => Date.now())

  const [rows, setRows] = useState<Row[]>(() =>
    day.items.flatMap(i => {
      const exId = legacyExId(i.exId)
      const prev = lastWorkSet(workouts, exId)
      return Array.from({ length: i.sets }, () => ({ exId, w: prev?.w ?? (unit === 'kg' ? 20 : 45), r: i.reps, done: false }))
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
    if (done) setRestLeft(restSec)
  }

  const finish = () => {
    const entries: Entry[] = []
    for (const r of rows) {
      if (!r.done) continue
      let e = entries.find(x => x.exId === r.exId)
      if (!e) entries.push((e = { exId: r.exId, sets: [] }))
      e.sets.push({ w: r.w, r: r.r, done: true })
    }
    if (entries.length === 0) return
    const { prs, e1prs } = detectRecords(entries, workouts, oneRmFormula)
    const end = Date.now()
    upsert('workouts', {
      id: crypto.randomUUID(), date: isoDate(new Date(start)), start, end, routineIds: [plan.id], name: day.name,
      entries, prs, e1prs, vol: workoutVolume(entries), updatedAt: end,
    })
    location.hash = '#/progress'
  }

  return (
    <>
      <h1>{t(lang, 'workout')}: {day.name}</h1>
      <p className="muted">{plan.name}</p>

      {day.items.map(item => {
        const exId = legacyExId(item.exId)
        const best = bestE1rm(exerciseHistory(workouts, exId), oneRmFormula)
        return (
          <section key={item.exId} className="card">
            <h2>{starterExName(item.exId, lang)}</h2>
            {rows.map((r, idx) => {
              if (r.exId !== exId) return null
              const isPr = r.done && best > 0 && e1rm(r.w, r.r, oneRmFormula) > best
              return (
                <div key={idx} className={`set ${r.done ? 'done' : ''}`}>
                  <input type="number" inputMode="decimal" value={r.w} onChange={e => set(idx, { w: Number(e.target.value) })} aria-label={unit} />
                  <span>{unit} ×</span>
                  <input type="number" inputMode="numeric" value={r.r} onChange={e => set(idx, { r: Number(e.target.value) })} aria-label="reps" />
                  {isPr && <Trophy size={16} className="pr" />}
                  <button className="check" onClick={() => toggle(idx)} aria-label={t(lang, 'done')} aria-pressed={r.done}><Check size={18} /></button>
                </div>
              )
            })}
          </section>
        )
      })}

      <div className="sticky-bar">
        <span className="muted">{restLeft > 0 ? `${t(lang, 'rest')}: ${restLeft}s` : `${rows.filter(r => r.done).length}/${rows.length}`}</span>
        <button className="btn primary" onClick={finish}>{t(lang, 'finish')}</button>
      </div>
    </>
  )
}

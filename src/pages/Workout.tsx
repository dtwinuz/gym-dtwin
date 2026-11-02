import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { t } from '../i18n'
import { fmtDate } from '../app/format'
import { hashQuery } from '../app/nav'
import { plannedOn } from '../app/plan'
import { useCustomExercises } from '../app/routineMap'
import { upsert, useProfile } from '../app/store'
import { exerciseById, exerciseName } from '../catalogue'
import { detectRecords, isoDate, parseIso, workoutVolume } from '../core/history'
import { modeOf } from '../core/progression'
import type { Entry, Mode, Routine, SetRow, Slot, Workout as W } from '../core/types'

interface Row {
  key: number
  w: number
  /** Reps, seconds or minutes, by the slot's mode. */
  v: number
  done: boolean
}

interface Item {
  key: number
  slot: Slot
  routineId: string
  mode: Mode
}

function lastWorkSet(workouts: W[], exId: string): SetRow | undefined {
  const sorted = [...workouts].sort((a, b) => b.start - a.start)
  for (const w of sorted) {
    const s = w.entries.find(x => x.exId === exId)?.sets.filter(x => x.done && !x.warmup).at(-1)
    if (s) return s
  }
}

const target = (s: Slot, mode: Mode) => (mode === 'time' ? s.sec ?? 30 : mode === 'cardio' ? s.min ?? 10 : s.reps)

export default function Workout() {
  const p = useProfile()
  const { lang, unit, restSec, oneRmFormula } = p.settings
  const { workouts } = p
  useCustomExercises(p.customEx)
  const today = isoDate(new Date())
  const [query] = useState(hashQuery)
  const requested = (query.get('routine') ?? '').split(',').filter(Boolean)
  const asked = query.get('date') ?? ''
  const date = /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today && !Number.isNaN(parseIso(asked).getTime()) ? asked : today
  const ids = requested.length ? requested : plannedOn(p, today, today)
  const routines = ids.map(id => p.routines.find(r => r.id === id)).filter((r): r is Routine => !!r)
  const items: Item[] = routines.flatMap(r => r.ex.map(slot => ({ slot, routineId: r.id, mode: modeOf(slot) }))).map((x, key) => ({ ...x, key }))
  const name = routines.map(r => r.name).join(' + ')
  const [start] = useState(() => Date.now())

  const [rows, setRows] = useState<Row[]>(() =>
    items.flatMap(i => {
      const prev = lastWorkSet(workouts, i.slot.exId)
      return Array.from({ length: i.mode === 'cardio' ? 1 : i.slot.sets }, () => ({ key: i.key, w: prev?.w ?? i.slot.weight, v: target(i.slot, i.mode), done: false }))
    }))
  const [restLeft, setRestLeft] = useState(0)

  useEffect(() => {
    if (restLeft <= 0) return
    const id = setTimeout(() => setRestLeft(r => r - 1), 1000)
    return () => clearTimeout(id)
  }, [restLeft])

  if (!items.length) {
    return (
      <>
        <h1>{t(lang, 'workout')}</h1>
        <div className="card empty">
          <p>{t(lang, 'workoutNone')}</p>
          <p className="muted">{t(lang, 'pickRoutine')}</p>
          <div className="row center"><a className="btn primary" href="#/plan/routines">{t(lang, 'plan')}</a></div>
        </div>
      </>
    )
  }

  const set = (idx: number, patch: Partial<Row>) => setRows(rs => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)))

  const toggle = (idx: number, item: Item) => {
    const done = !rows[idx].done
    set(idx, { done })
    if (done && !item.slot.restOff) setRestLeft(item.slot.restSec ?? restSec)
  }

  const finish = () => {
    const entries: Entry[] = []
    for (const i of items) {
      const sets: SetRow[] = rows.filter(r => r.key === i.key && r.done).map(r => {
        if (i.mode === 'time') return { w: r.w, sec: r.v, done: true }
        if (i.mode === 'cardio') return { min: r.v, done: true }
        return { w: r.w, r: r.v, done: true }
      })
      if (sets.length) entries.push({ exId: i.slot.exId, sets, target: i.slot, routineId: i.routineId, sg: i.slot.sg })
    }
    if (entries.length === 0) return
    const { prs, e1prs } = detectRecords(entries, workouts, oneRmFormula)
    const end = Date.now()
    const when = date === today ? start : parseIso(date).getTime() + 12 * 3600 * 1000
    upsert('workouts', {
      id: crypto.randomUUID(), date, start: when, end: date === today ? end : when, routineIds: routines.map(r => r.id), name,
      entries, prs, e1prs, vol: workoutVolume(entries), updatedAt: end,
    })
    location.hash = '#/progress'
  }

  return (
    <>
      <h1>{t(lang, 'workout')}: {name}</h1>
      {date !== today && <p className="muted">{t(lang, 'pastDate')}: {fmtDate(date, lang)}</p>}

      {items.map(item => (
        <section key={item.key} className="card">
          <h2>{exerciseName(exerciseById(item.slot.exId), lang)}</h2>
          {rows.map((r, idx) => {
            if (r.key !== item.key) return null
            const valueLabel = t(lang, item.mode === 'time' ? 'secShort' : item.mode === 'cardio' ? 'minShort' : 'modeReps')
            return (
              <div key={idx} className={`set ${r.done ? 'done' : ''}`}>
                {item.mode !== 'cardio' && (
                  <>
                    <input type="number" inputMode="decimal" value={r.w} onChange={e => set(idx, { w: Number(e.target.value) })} aria-label={unit} />
                    <span>{unit} ×</span>
                  </>
                )}
                <input type="number" inputMode="numeric" value={r.v} onChange={e => set(idx, { v: Number(e.target.value) })} aria-label={valueLabel} />
                {item.mode !== 'reps' && <span>{valueLabel}</span>}
                <button className="check" onClick={() => toggle(idx, item)} aria-label={t(lang, 'done')} aria-pressed={r.done}><Check size={18} /></button>
              </div>
            )
          })}
        </section>
      ))}

      <div className="sticky-bar">
        <span className="muted">{restLeft > 0 ? `${t(lang, 'rest')}: ${restLeft}${t(lang, 'secShort')}` : `${rows.filter(r => r.done).length}/${rows.length}`}</span>
        <button className="btn primary" onClick={finish}>{t(lang, 'finish')}</button>
      </div>
    </>
  )
}

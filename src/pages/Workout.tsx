import { useEffect, useState } from 'react'
import { Play, Plus } from 'lucide-react'
import { t, type Key } from '../i18n'
import { fmtDate } from '../app/format'
import { hashQuery } from '../app/nav'
import { plannedOn } from '../app/plan'
import { useCustomExercises } from '../app/routineMap'
import { parseEntry, sameEntry, startSession } from '../app/session'
import { getProfile, updateProfile, useProfile } from '../app/store'
import { isoDate } from '../core/history'
import type { ISODate, Profile, Routine } from '../core/types'
import Logger from './workout/Logger'

const begin = (ids: string[], date: ISODate, freestyle: string) =>
  updateProfile(p => (p.active ? p : { ...p, active: startSession(p, ids, date, freestyle) }))

/** The query did its job: a reload or a back step must not start another session. */
const clearQuery = () => {
  if (location.hash.includes('?')) history.replaceState(history.state, '', '#/workout')
}

function StartScreen({ p, today }: { p: Profile; today: ISODate }) {
  const { lang } = p.settings
  const L = (k: Key) => t(lang, k)
  const planned = plannedOn(p, today, today)
  const routines = planned.map(id => p.routines.find(r => r.id === id)).filter((r): r is Routine => !!r)
  const others = p.routines.filter(r => !planned.includes(r.id))
  return (
    <>
      <h1>{L('workout')}</h1>
      <section className="card start-today">
        {routines.length > 0 ? (
          <>
            <p className="muted">{L('today')}</p>
            <h2>{routines.map(r => r.name).join(' + ')}</h2>
            <button type="button" className="btn primary big" data-start-today onClick={() => begin(planned, today, L('freestyle'))}><Play size={20} />{L('start')}</button>
          </>
        ) : (
          <>
            <p>{L('workoutNone')}</p>
            <p className="muted">{L('pickRoutine')}</p>
          </>
        )}
      </section>
      {others.length > 0 && (
        <section className="card">
          <h2>{L('tabRoutines')}</h2>
          <ul className="start-list">
            {others.map(r => (
              <li key={r.id}>
                <span>{r.glyph && <span className="glyph">{r.glyph}</span>}<b>{r.name}</b></span>
                <button type="button" className="btn small" data-start-routine={r.id} onClick={() => begin([r.id], today, L('freestyle'))}><Play size={16} />{L('start')}</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="row center wrap">
        <button type="button" className="btn" data-freestyle onClick={() => begin([], today, L('freestyle'))}><Plus size={16} />{L('freestyle')}</button>
        <a className="btn" href="#/plan/routines">{L('plan')}</a>
      </div>
    </>
  )
}

export default function Workout() {
  const p = useProfile()
  const { lang } = p.settings
  const L = (k: Key) => t(lang, k)
  useCustomExercises(p.customEx)
  const today = isoDate(new Date())
  const [query, setQuery] = useState(hashQuery)
  useEffect(() => {
    const read = () => setQuery(hashQuery())
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])
  const { ids, date } = parseEntry(query, p, today)
  const wanted = ids.length > 0
  const active = p.active
  const clash = wanted && !!active && !sameEntry(active, ids, date)

  useEffect(() => {
    if (!wanted) {
      clearQuery()
      return
    }
    const running = getProfile().active
    if (running && !sameEntry(running, ids, date)) return
    if (!running) begin(ids, date, '')
    clearQuery()
    setQuery(new URLSearchParams())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, ids.join(','), date])

  if (clash && active) {
    const asked = ids.map(id => p.routines.find(r => r.id === id)?.name ?? '?').join(' + ')
    const dismiss = () => {
      clearQuery()
      setQuery(new URLSearchParams())
    }
    return (
      <>
        <h1>{L('workout')}</h1>
        <section className="card clash">
          <h2>{L('sessionRunning')}</h2>
          <p className="muted">{active.name} · {fmtDate(active.date, lang)}</p>
          <p>{L('sessionClash')}: <b>{asked}</b></p>
          <div className="row wrap">
            <button type="button" className="btn primary" data-continue onClick={dismiss}>{L('continueSession')}</button>
            <button
              type="button" className="btn danger" data-replace
              onClick={() => {
                updateProfile(x => ({ ...x, active: null }))
                begin(ids, date, '')
                dismiss()
              }}
            >{L('discardAndStart')}</button>
          </div>
        </section>
      </>
    )
  }

  if (active) return <Logger key={active.id} p={p} s={active} />
  if (wanted) return null
  return <StartScreen p={p} today={today} />
}

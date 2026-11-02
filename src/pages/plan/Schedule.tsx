import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronRight, RotateCcw, X } from 'lucide-react'
import { t, type Key } from '../../i18n'
import Sheet from '../../app/Sheet'
import { fmtDate, weekdayName } from '../../app/format'
import { goAfterSheet } from '../../app/nav'
import { moveSession, orderedWeekdays, plannedOn, restartRotation, setDayOverride, setRotationSequence, setScheduleMode, setWeekDay } from '../../app/plan'
import { moveItem } from '../../app/slots'
import { updateProfile, useProfile } from '../../app/store'
import { toast } from '../../app/toast'
import { addDays, isoDate, parseIso, sortByStart } from '../../core/history'
import { REST, rotationState, workoutsOn } from '../../core/schedule'
import type { Profile } from '../../core/types'

const workoutUrl = (routineIds: string[], date?: string) =>
  `#/workout?routine=${routineIds.map(encodeURIComponent).join(',')}${date ? `&date=${date}` : ''}`

function WeekEditor({ p }: { p: Profile }) {
  const { lang, weekStart } = p.settings
  const L = (k: Key) => t(lang, k)
  const nameOf = (id: string) => p.routines.find(r => r.id === id)?.name ?? '?'
  return (
    <>
      <p className="muted hint">{L('weekHint')}</p>
      <ul className="week-list">
        {orderedWeekdays(weekStart).map(d => {
          const ids = (p.week[d] ?? []).filter(id => p.routines.some(r => r.id === id))
          return (
            <li key={d}>
              <b className="week-day">{weekdayName(d, lang)}</b>
              <div className="week-items">
                {ids.length === 0 && <span className="muted">{L('rest')}</span>}
                {ids.map((id, i) => (
                  <span key={`${id}-${i}`} className="pill">
                    {nameOf(id)}
                    <button type="button" aria-label={L('remove')} onClick={() => updateProfile(x => setWeekDay(x, d, ids.filter((_, n) => n !== i)))}><X size={14} /></button>
                  </span>
                ))}
              </div>
              <select
                className="input week-add" value="" aria-label={`${weekdayName(d, lang)}: ${L('addRoutineTo')}`}
                onChange={e => { if (e.target.value) updateProfile(x => setWeekDay(x, d, [...ids, e.target.value])) }}
              >
                <option value="">{L('addRoutineTo')}</option>
                {p.routines.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function RotationEditor({ p }: { p: Profile }) {
  const { lang } = p.settings
  const L = (k: Key) => t(lang, k)
  const seq = p.rotation?.sequence ?? []
  const next = p.rotation ? rotationState(p.rotation, p.workouts).next : -1
  const set = (s: string[]) => updateProfile(x => setRotationSequence(x, s))
  const nameOf = (id: string) => (id === REST ? L('rest') : p.routines.find(r => r.id === id)?.name ?? '?')
  return (
    <>
      <p className="muted hint">{L('rotationHint')}</p>
      <ol className="loop-list">
        {seq.map((id, i) => (
          <li key={`${id}-${i}`} className={id === REST ? 'is-rest' : ''}>
            <span className="loop-n">{i + 1}</span>
            <span className="loop-name">{nameOf(id)}</span>
            {i === next && <span className="badge">{L('nextUp')}</span>}
            <button type="button" className="icon-btn" disabled={i === 0} aria-label={L('moveUp')} onClick={() => set(moveItem(seq, i, i - 1))}><ArrowUp size={16} /></button>
            <button type="button" className="icon-btn" disabled={i === seq.length - 1} aria-label={L('moveDown')} onClick={() => set(moveItem(seq, i, i + 1))}><ArrowDown size={16} /></button>
            <button type="button" className="icon-btn" aria-label={L('remove')} onClick={() => set(seq.filter((_, n) => n !== i))}><X size={16} /></button>
          </li>
        ))}
      </ol>
      <div className="row wrap">
        <select className="input week-add" value="" aria-label={L('addToLoop')} onChange={e => { if (e.target.value) set([...seq, e.target.value]) }}>
          <option value="">{L('addToLoop')}</option>
          {p.routines.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          <option value={REST}>{L('rest')}</option>
        </select>
        <button type="button" className="btn small" onClick={() => updateProfile(x => restartRotation(x))}><RotateCcw size={16} />{L('restartLoop')}</button>
      </div>
    </>
  )
}

function DaySheet({ iso, today, onClose }: { iso: string; today: string; onClose: () => void }) {
  const p = useProfile()
  const { lang } = p.settings
  const L = (k: Key) => t(lang, k)
  const ids = plannedOn(p, iso, today)
  const [target, setTarget] = useState('')
  const dates = Array.from({ length: 14 }, (_, i) => addDays(today, i)).filter(d => d !== iso)
  const go = (hash: string) => {
    onClose()
    goAfterSheet(hash)
  }
  return (
    <Sheet onClose={onClose} label={fmtDate(iso, lang)} className="form day-sheet">
      <header className="sheet-head">
        <h2>{fmtDate(iso, lang, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={L('close')}><X size={20} /></button>
      </header>
      <label>
        {L('forThisDay')}
        <select className="input" value={p.dayPlan[iso] ?? ''} onChange={e => updateProfile(x => setDayOverride(x, iso, e.target.value || null))}>
          <option value="">{L('asScheduled')}</option>
          {p.routines.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          <option value={REST}>{L('rest')}</option>
        </select>
      </label>
      {ids.length > 0 && (
        <div className="move-row">
          <label className="grow">
            {L('moveTo')}
            <select className="input" value={target} onChange={e => setTarget(e.target.value)}>
              <option value="">{L('date')}…</option>
              {dates.map(d => <option key={d} value={d}>{fmtDate(d, lang, { weekday: 'short', day: 'numeric', month: 'short' })}</option>)}
            </select>
          </label>
          <button
            type="button" className="btn" disabled={!target}
            onClick={() => {
              updateProfile(x => moveSession(x, iso, ids[0], target, today))
              toast(L('moved'))
              onClose()
            }}
          >
            {L('save')}
          </button>
        </div>
      )}
      {iso === today && ids.length > 0 && <button type="button" className="btn primary" onClick={() => go(workoutUrl(ids))}>{L('start')}</button>}
    </Sheet>
  )
}

function Agenda({ p, today }: { p: Profile; today: string }) {
  const { lang } = p.settings
  const L = (k: Key) => t(lang, k)
  const [open, setOpen] = useState<string | null>(null)
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i))
  return (
    <section className="card">
      <h2>{L('upcoming')}</h2>
      <p className="muted hint">{L('upcomingHint')}</p>
      <ul className="agenda">
        {days.map(d => {
          const ids = plannedOn(p, d, today)
          const done = workoutsOn(p.workouts, d).length > 0
          return (
            <li key={d}>
              <button type="button" className={`agenda-row${d === today ? ' today' : ''}`} onClick={() => setOpen(d)}>
                <span className="agenda-date">{fmtDate(d, lang, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <span className={`agenda-what${ids.length ? '' : ' muted'}`}>{ids.length ? ids.map(id => p.routines.find(r => r.id === id)?.name ?? '?').join(', ') : L('rest')}</span>
                {done && <span className="badge">{L('stDone')}</span>}
                {p.dayPlan[d] && <span className="badge alt">{L('changed')}</span>}
                <ChevronRight size={16} className="muted" />
              </button>
            </li>
          )
        })}
      </ul>
      {open && <DaySheet iso={open} today={today} onClose={() => setOpen(null)} />}
    </section>
  )
}

function QuickLog({ p, today }: { p: Profile; today: string }) {
  const { lang } = p.settings
  const L = (k: Key) => t(lang, k)
  const last = sortByStart(p.workouts).reverse().find(w => w.routineIds.some(id => p.routines.some(r => r.id === id)))
  const lastIds = last?.routineIds.filter(id => p.routines.some(r => r.id === id)) ?? []
  const yesterday = addDays(today, -1)
  const [date, setDate] = useState(yesterday)
  const [routine, setRoutine] = useState('')
  const pick = routine || p.routines[0]?.id || ''
  const validDate = !!date && !Number.isNaN(parseIso(date).getTime()) && date <= today
  return (
    <section className="card">
      {lastIds.length > 0 && (
        <div className="row wrap between">
          <span>{last?.name}</span>
          <a className="btn small" href={workoutUrl(lastIds)}><RotateCcw size={16} />{L('repeatToday')}</a>
        </div>
      )}
      <h2>{L('logPast')}</h2>
      <div className="move-row">
        <label className="field">
          {L('date')}
          <input className="input" type="date" max={today} value={date} onChange={e => setDate(e.target.value)} />
        </label>
        <label className="field grow">
          {L('routine')}
          <select className="input" value={pick} onChange={e => setRoutine(e.target.value)}>
            {p.routines.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        {validDate && pick
          ? <a className="btn" href={workoutUrl([pick], date)}>{L('logIt')}</a>
          : <button type="button" className="btn" disabled>{L('logIt')}</button>}
      </div>
    </section>
  )
}

export default function Schedule() {
  const p = useProfile()
  const { lang } = p.settings
  const L = (k: Key) => t(lang, k)
  const today = isoDate(new Date())
  return (
    <>
      <section className="card">
        <div className="seg mode-seg" role="radiogroup" aria-label={L('tabSchedule')}>
          {(['week', 'rotation'] as const).map(m => (
            <button
              type="button" key={m} role="radio" aria-checked={p.scheduleMode === m} className={p.scheduleMode === m ? 'on' : ''}
              onClick={() => updateProfile(x => setScheduleMode(x, m))}
            >
              {L(m === 'week' ? 'modeWeek' : 'modeRotation')}
            </button>
          ))}
        </div>
        {p.scheduleMode === 'rotation' ? <RotationEditor p={p} /> : <WeekEditor p={p} />}
      </section>
      <Agenda p={p} today={today} />
      <QuickLog p={p} today={today} />
    </>
  )
}

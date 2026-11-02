import { useMemo, useState } from 'react'
import { Download, Send, Trophy, X } from 'lucide-react'
import { t, type Key } from '../../i18n'
import Sheet from '../../app/Sheet'
import { fmtDate, fmtNum } from '../../app/format'
import { goAfterSheet } from '../../app/nav'
import { telegramShareUrl } from '../../app/planFile'
import { addToRoutine, addedEntries, draftWorkout, finishSession, isPast, nextTime, previousOfRoutine, workoutMinutes } from '../../app/session'
import { SHARE_SITE, shareCard, workoutText } from '../../app/share'
import { slotSummary } from '../../app/slotText'
import { updateProfile } from '../../app/store'
import { toast } from '../../app/toast'
import { exerciseById, exerciseName } from '../../catalogue'
import { bestE1rm, bestLoad, setsDone } from '../../core/history'
import type { ActiveSession, Profile } from '../../core/types'
import { WHY_KEY, updateActive } from './active'

function Delta({ now, was, unit, lang, neutral }: { now: number; was: number; unit: string; lang: Profile['settings']['lang']; neutral?: boolean }) {
  const d = Math.round((now - was) * 10) / 10
  return <b className={neutral ? '' : d > 0 ? 'delta-up' : d < 0 ? 'delta-down' : ''}>{d > 0 ? '+' : ''}{fmtNum(d, lang)} {unit}</b>
}

export default function FinishSheet({ p, s, onClose }: { p: Profile; s: ActiveSession; onClose: () => void }) {
  const { settings } = p
  const { lang, unit } = settings
  const L = (k: Key) => t(lang, k)
  const [noProg, setNoProg] = useState(false)
  const [addNew, setAddNew] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [now] = useState(Date.now)
  const note = s.note ?? ''
  const w = useMemo(() => draftWorkout(p, s, { now, noProg, note }), [p, s, now, noProg, note])
  const prev = useMemo(() => previousOfRoutine(p, w), [p, w])
  const next = useMemo(() => nextTime(p, w), [p, w])
  const added = addedEntries(w)
  const sets = setsDone(w.entries)
  const minutes = workoutMinutes(w)
  const past = isPast(s)
  const name = (id: string) => exerciseName(exerciseById(id), lang)
  const ofEx = (id: string) => w.entries.filter(e => e.exId === id)

  const save = () => {
    goAfterSheet('#/progress')
    updateProfile(x => {
      const saved = finishSession(x, draftWorkout(x, s, { now, noProg, note }), Date.now())
      return addNew && added.length && w.routineIds[0] ? addToRoutine(saved, w.routineIds[0], added) : saved
    })
    toast(L('workoutSaved'))
  }
  const discard = () => {
    goAfterSheet('#/home')
    updateProfile(x => ({ ...x, active: null }))
    toast(L('workoutDiscarded'))
  }
  const share = async () => {
    const r = await shareCard(w, settings)
    if (r === 'saved') toast(L('cardSaved'))
    if (r === 'failed') toast(L('cardFailed'))
  }

  return (
    <Sheet onClose={onClose} label={L('finishTitle')} className="finish-sheet">
      <header className="sheet-head">
        <h2>{L('finishTitle')}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={L('close')}><X size={20} /></button>
      </header>

      <p className="muted">{w.name} · {fmtDate(w.date, lang)}</p>
      <div className="stats finish-stats">
        <div className="card stat"><b>{past ? '—' : `${minutes} ${L('minShort')}`}</b><span>{L('duration')}</span></div>
        <div className="card stat"><b>{fmtNum(w.vol, lang, 0)} {unit}</b><span>{L('volumeShort')}</span></div>
        <div className="card stat"><b>{sets}</b><span>{L('sets')}</span></div>
      </div>

      {prev && (
        <div className="finish-block compare">
          <h3 className="sec">{L('compareTitle')} · {fmtDate(prev.date, lang, { day: 'numeric', month: 'short' })}</h3>
          <ul className="list">
            <li><span>{L('volumeShort')}</span><Delta now={w.vol} was={prev.vol} unit={unit} lang={lang} /></li>
            <li><span>{L('sets')}</span><Delta now={sets} was={prev.sets} unit="" lang={lang} /></li>
            {!past && <li><span>{L('duration')}</span><Delta now={minutes} was={prev.minutes} unit={L('minShort')} lang={lang} neutral /></li>}
          </ul>
        </div>
      )}

      {(w.prs.length > 0 || (w.e1prs?.length ?? 0) > 0) && (
        <div className="finish-block prs">
          <h3 className="sec"><Trophy size={16} /> {L('newRecords')}</h3>
          <ul className="list">
            {w.prs.map(id => <li key={id}><span>{name(id)}</span><b className="pr">{L('prLoad')} · {fmtNum(bestLoad(ofEx(id)), lang, 2)} {unit}</b></li>)}
            {w.e1prs?.map(id => <li key={id}><span>{name(id)}</span><b className="pr">{L('prE1rm')} · {fmtNum(bestE1rm(ofEx(id), settings.oneRmFormula), lang)} {unit}</b></li>)}
          </ul>
        </div>
      )}

      {next.length > 0 && (
        <div className="finish-block next-list">
          <h3 className="sec">{L('nextTime')}</h3>
          <ul className="list">
            {next.map(n => (
              <li key={n.exId}>
                <span>{name(n.exId)}<small className="muted why-line">{L(WHY_KEY[n.rx.why])}</small></span>
                <b>{slotSummary({ ...n.slot, sets: n.rx.sets, reps: n.rx.reps, weight: n.rx.weight, sec: n.rx.sec, repsMin: undefined }, settings)}</b>
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="check-row finish-toggle">
        <input type="checkbox" className="switch" checked={noProg} onChange={e => setNoProg(e.target.checked)} />
        <span>{L('noProg')}<small className="muted why-line">{L('noProgHint')}</small></span>
      </label>
      {added.length > 0 && (
        <label className="check-row finish-toggle">
          <input type="checkbox" className="switch" checked={addNew} onChange={e => setAddNew(e.target.checked)} />
          <span>{L('addToRoutine')}<small className="muted why-line">{added.map(e => name(e.exId)).join(', ')}</small></span>
        </label>
      )}

      <label className="field finish-note">
        {L('sessionNote')}
        <textarea className="input" rows={2} maxLength={1000} value={note} onChange={e => { const text = e.target.value; updateActive(x => ({ ...x, note: text })) }} />
      </label>

      {sets === 0 && <p className="muted hint">{L('noSetsYet')}</p>}

      <div className="row wrap share-row">
        <button type="button" className="btn small" disabled={sets === 0} onClick={share}><Download size={16} />{L('shareImage')}</button>
        {sets > 0 && <a className="btn small" href={telegramShareUrl(SHARE_SITE, workoutText(w, settings))} target="_blank" rel="noopener noreferrer"><Send size={16} />{L('telegramShare')}</a>}
      </div>
      <div className="row between finish-actions">
        <button type="button" className="btn danger" data-discard onClick={() => setConfirm(true)}>{L('discard')}</button>
        <button type="button" className="btn primary" data-save disabled={sets === 0} onClick={save}>{L('saveWorkout')}</button>
      </div>

      {confirm && (
        <Sheet onClose={() => setConfirm(false)} label={L('discardAsk')} className="confirm">
          <h2>{L('discardAsk')}</h2>
          <p className="muted">{L('discardText')}</p>
          <div className="row between">
            <button type="button" className="btn" onClick={() => setConfirm(false)}>{L('cancel')}</button>
            <button type="button" className="btn danger" data-discard-yes onClick={discard}>{L('discard')}</button>
          </div>
        </Sheet>
      )}
    </Sheet>
  )
}

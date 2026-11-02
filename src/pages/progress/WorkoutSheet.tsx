import { Download, Pencil, Play, Send, Trash2, Trophy, X } from 'lucide-react'
import { t, type Key } from '../../i18n'
import Sheet from '../../app/Sheet'
import { fmtDate, fmtNum } from '../../app/format'
import { goAfterSheet } from '../../app/nav'
import { telegramShareUrl } from '../../app/planFile'
import { deleteWorkout, repeatSession, saveWorkout, timeOf } from '../../app/records'
import { workoutMinutes } from '../../app/session'
import { SHARE_SITE, recordsOf, setText, shareCard, workoutText } from '../../app/share'
import { getProfile, updateProfile } from '../../app/store'
import { toast } from '../../app/toast'
import { exerciseById, exerciseName } from '../../catalogue'
import { setsDone } from '../../core/history'
import type { Profile, SetRow, Workout } from '../../core/types'

function rowTags(s: SetRow, L: (k: Key) => string) {
  const out: string[] = []
  if (s.warmup) out.push(L('setWarmup'))
  if (s.failure) out.push(L('setFailure'))
  if (s.rir != null) out.push(`RIR ${s.rir}`)
  if (s.rpe != null) out.push(`RPE ${s.rpe}`)
  return out.join(' · ')
}

export default function WorkoutSheet({ p, w, onClose, onEdit }: { p: Profile; w: Workout; onClose: () => void; onEdit: () => void }) {
  const { settings } = p
  const { lang, unit } = settings
  const L = (k: Key) => t(lang, k)
  const minutes = workoutMinutes(w)
  const records = recordsOf(w)

  const repeat = () => {
    if (getProfile().active) {
      toast(L('sessionRunning'), { label: L('continueSession'), run: () => { goAfterSheet('#/workout'); onClose() } })
      return
    }
    goAfterSheet('#/workout')
    updateProfile(x => ({ ...x, active: repeatSession(x, w) }))
    onClose()
  }
  const remove = () => {
    onClose()
    updateProfile(x => deleteWorkout(x, w.id))
    toast(L('workoutDeleted'), { label: L('undo'), run: () => updateProfile(x => saveWorkout(x, w)) })
  }
  const share = async () => {
    const r = await shareCard(w, settings)
    if (r === 'saved') toast(L('cardSaved'))
    if (r === 'failed') toast(L('cardFailed'))
  }

  return (
    <Sheet onClose={onClose} label={w.name} className="workout-sheet">
      <header className="sheet-head">
        <h2>{w.name}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={L('close')}><X size={20} /></button>
      </header>
      <p className="muted">{fmtDate(w.date, lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{minutes > 0 ? ` · ${timeOf(w.start)}` : ''}</p>
      <div className="stats finish-stats">
        <div className="card stat"><b>{minutes > 0 ? `${minutes} ${L('minShort')}` : '—'}</b><span>{L('duration')}</span></div>
        <div className="card stat"><b>{fmtNum(w.vol, lang, 0)} {unit}</b><span>{L('volumeShort')}</span></div>
        <div className="card stat"><b>{setsDone(w.entries)}</b><span>{L('sets')}</span></div>
      </div>

      {records.length > 0 && (
        <div className="finish-block">
          <h3 className="sec"><Trophy size={16} /> {L('newRecords')}</h3>
          <p>{records.map(id => exerciseName(exerciseById(id), lang)).join(', ')}</p>
        </div>
      )}

      {w.note && <p className="recent-note workout-note">{w.note}</p>}

      {w.entries.map((e, i) => (
        <div key={i} className="finish-block workout-entry">
          <h3 className="sec">{exerciseName(exerciseById(e.exId), lang)}</h3>
          {e.note && <p className="muted recent-note">{e.note}</p>}
          <ol className="set-lines">
            {e.sets.map((s, j) => {
              const tags = rowTags(s, L)
              return (
                <li key={j} className={s.warmup ? 'warm' : ''}>
                  <span>{setText(s, settings)}{s.drops?.map((d, k) => <span key={k} className="muted"> → {fmtNum(d.w, lang, 2)} {unit} × {d.r}</span>)}</span>
                  {tags && <small className="muted">{tags}</small>}
                </li>
              )
            })}
          </ol>
        </div>
      ))}

      <div className="row wrap share-row">
        <button type="button" className="btn small" onClick={share}><Download size={16} />{L('shareImage')}</button>
        <a className="btn small" href={telegramShareUrl(SHARE_SITE, workoutText(w, settings))} target="_blank" rel="noopener noreferrer"><Send size={16} />{L('telegramShare')}</a>
      </div>
      <div className="row between wrap finish-actions">
        <button type="button" className="btn danger" data-delete-workout onClick={remove}><Trash2 size={16} />{L('remove')}</button>
        <span className="row-gap">
          <button type="button" className="btn" data-edit-workout onClick={onEdit}><Pencil size={16} />{L('edit')}</button>
          <button type="button" className="btn primary" data-repeat onClick={repeat}><Play size={16} />{L('repeatWorkout')}</button>
        </span>
      </div>
    </Sheet>
  )
}

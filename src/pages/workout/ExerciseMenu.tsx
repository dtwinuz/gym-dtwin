import { useState } from 'react'
import { ArrowLeftRight, Link2, Search, Trash2, Unlink, X } from 'lucide-react'
import { t, type Key } from '../../i18n'
import Sheet from '../../app/Sheet'
import { barWeightOf, entryMode, pairExercises, removeExercise, splitSuperset, swapExercise } from '../../app/session'
import { updateProfile } from '../../app/store'
import { toast } from '../../app/toast'
import { exerciseById, exerciseName, similarExercises } from '../../catalogue'
import { BAR_DEFAULTS } from '../../core/plates'
import type { ActiveSession, Profile } from '../../core/types'
import ExercisePicker from '../plan/ExercisePicker'
import { updateActive } from './active'
import NumInput from './NumInput'

const BARS: [Key, string][] = [['barOlympic', 'barbell'], ['barEz', 'ez bar'], ['barTrap', 'trap bar'], ['barSmith', 'smith']]

export default function ExerciseMenu({ p, s, ei, onClose }: { p: Profile; s: ActiveSession; ei: number; onClose: () => void }) {
  const { lang, unit } = p.settings
  const L = (k: Key) => t(lang, k)
  const e = s.entries[ei]
  const [view, setView] = useState<'main' | 'swap' | 'pair'>('main')
  const [search, setSearch] = useState(false)
  if (!e) return null
  const nameOf = (id: string) => exerciseName(exerciseById(id), lang)
  const subs = (e.target?.subs ?? []).filter(id => exerciseById(id))
  const similar = similarExercises(e.exId, 6).filter(x => !subs.includes(x.id))
  const bar = barWeightOf(p, e.exId)

  const swap = (id: string) => {
    updateActive(x => swapExercise(p, x, ei, id))
    onClose()
  }
  const remove = () => {
    const before = s.entries
    updateActive(x => removeExercise(x, ei))
    toast(L('exRemoved'), { label: L('undo'), run: () => updateActive(x => ({ ...x, entries: before })) })
    onClose()
  }
  const setBar = (w: number | undefined) => updateProfile(x => {
    const barWeights = { ...x.barWeights }
    if (w == null) delete barWeights[e.exId]
    else barWeights[e.exId] = w
    return { ...x, barWeights }
  })
  const setNote = (text: string) => updateProfile(x => {
    const exNotes = { ...x.exNotes }
    if (text.trim()) exNotes[e.exId] = text.slice(0, 500)
    else delete exNotes[e.exId]
    return { ...x, exNotes }
  })

  return (
    <Sheet onClose={onClose} label={L('exMenu')} className="menu-sheet">
      <header className="sheet-head">
        <h2>{nameOf(e.exId)}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={L('close')}><X size={20} /></button>
      </header>

      {view === 'swap' && (
        <>
          {subs.length > 0 && <h3 className="sec">{L('backupsShort')}</h3>}
          <div className="menu-list">
            {subs.map(id => <button type="button" key={id} className="btn" data-sub={id} onClick={() => swap(id)}>{nameOf(id)}</button>)}
          </div>
          {similar.length > 0 && <h3 className="sec">{L('similar')}</h3>}
          <div className="menu-list">
            {similar.map(x => <button type="button" key={x.id} className="btn" data-similar={x.id} onClick={() => swap(x.id)}>{exerciseName(x, lang)}</button>)}
            <button type="button" className="btn" onClick={() => setSearch(true)}><Search size={16} />{L('searchAll')}</button>
          </div>
        </>
      )}

      {view === 'pair' && (
        <div className="menu-list">
          {s.entries.map((x, i) => (i === ei ? null : (
            <button type="button" key={i} className="btn" onClick={() => { updateActive(a => pairExercises(a, ei, i)); onClose() }}>{nameOf(x.exId)}</button>
          )))}
        </div>
      )}

      {view === 'main' && (
        <>
          {subs.length > 0 && (
            <div className="tags sub-chips">
              {subs.map(id => <button type="button" key={id} className="btn small" data-sub={id} onClick={() => swap(id)}><ArrowLeftRight size={14} />{nameOf(id)}</button>)}
            </div>
          )}
          <div className="menu-list">
            <button type="button" className="btn" onClick={() => setView('swap')}><ArrowLeftRight size={16} />{L('swapEx')}</button>
            {e.sg
              ? <button type="button" className="btn" onClick={() => { updateActive(x => splitSuperset(x, ei)); onClose() }}><Unlink size={16} />{L('unlinkSuperset')}</button>
              : s.entries.length > 1 && <button type="button" className="btn" onClick={() => setView('pair')}><Link2 size={16} />{L('pairWith')}</button>}
            <button type="button" className="btn danger" onClick={remove}><Trash2 size={16} />{L('removeEx')}</button>
          </div>

          {entryMode(e) === 'reps' && (
            <>
              <h3 className="sec">{L('barWeight')}</h3>
              <div className="chips bar-chips">
                {BARS.map(([k, id]) => {
                  const w = BAR_DEFAULTS[id][unit]
                  return <button type="button" key={id} className={bar === w ? 'on' : ''} aria-pressed={bar === w} onClick={() => setBar(w)}>{L(k)} {w}</button>
                })}
                <button type="button" className={bar === 0 ? 'on' : ''} aria-pressed={bar === 0} onClick={() => setBar(0)}>{L('barNone')}</button>
                <label className="bar-custom"><NumInput value={bar} label={`${L('barWeight')}, ${unit}`} onChange={setBar} /><span className="muted">{unit}</span></label>
              </div>
            </>
          )}

          <h3 className="sec">{L('exNote')}</h3>
          <textarea className="input" rows={2} maxLength={500} defaultValue={p.exNotes[e.exId] ?? ''} placeholder={L('exNoteHint')} aria-label={L('exNote')} onChange={ev => setNote(ev.target.value)} />
        </>
      )}

      {search && <ExercisePicker exclude={[e.exId]} onClose={() => setSearch(false)} onPick={x => { setSearch(false); swap(x.id) }} />}
    </Sheet>
  )
}

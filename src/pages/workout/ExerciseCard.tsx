import { useState } from 'react'
import { Check, ChevronDown, Link2, MoreVertical, Plus } from 'lucide-react'
import { t, type Key } from '../../i18n'
import Sheet from '../../app/Sheet'
import { exerciseById, exerciseName } from '../../catalogue'
import { setText } from '../../app/share'
import { addDrop, addSet, entryMode, patchSet, refEntry, removeSet } from '../../app/session'
import { slotSummary } from '../../app/slotText'
import { toast } from '../../app/toast'
import { exerciseHistory, topSet } from '../../core/history'
import type { ActiveSession, Entry, Profile, SetRow, Slot } from '../../core/types'
import { WHY_KEY, updateActive } from './active'
import SetRowView from './SetRowView'

function rowLabel(sets: SetRow[], si: number) {
  const row = sets[si]
  if (row.warmup) return 'W'
  if (row.rp) return 'RP'
  return String(sets.slice(0, si + 1).filter(x => !x.warmup && !x.rp).length)
}

function SetMenu({ p, s, ei, si, onClose, onDelete }: { p: Profile; s: ActiveSession; ei: number; si: number; onClose: () => void; onDelete: () => void }) {
  const { lang, unit } = p.settings
  const L = (k: Key) => t(lang, k)
  const row = s.entries[ei].sets[si]
  const mode = entryMode(s.entries[ei])
  const toggle = (patch: Partial<SetRow>) => {
    updateActive(x => patchSet(x, ei, si, patch))
    onClose()
  }
  return (
    <Sheet onClose={onClose} label={L('setMenu')} className="menu-sheet">
      <h2>{L('setMenu')} {rowLabel(s.entries[ei].sets, si)}</h2>
      <div className="menu-list">
        <button type="button" className={`btn${row.warmup ? ' on' : ''}`} aria-pressed={!!row.warmup} onClick={() => toggle({ warmup: !row.warmup || undefined, rp: undefined })}>{L('setWarmup')}</button>
        {mode === 'reps' && (
          <>
            <button type="button" className="btn" onClick={() => { updateActive(x => addDrop(x, ei, si, unit)); onClose() }}>{L('addDrop')}</button>
            <button type="button" className={`btn${row.rp ? ' on' : ''}`} aria-pressed={!!row.rp} onClick={() => toggle({ rp: !row.rp || undefined, warmup: undefined })}>{L('restpause')}</button>
            <button type="button" className={`btn${row.failure ? ' on' : ''}`} aria-pressed={!!row.failure} onClick={() => toggle({ failure: !row.failure || undefined })}>{L('setFailure')}</button>
          </>
        )}
        <button type="button" className="btn danger" onClick={() => { onClose(); onDelete() }}>{L('remove')}</button>
      </div>
    </Sheet>
  )
}

const planned = (e: Entry, slot: Slot): Slot => ({ ...slot, sets: e.rx?.sets ?? slot.sets, reps: e.rx?.reps ?? slot.reps, weight: e.rx?.weight ?? slot.weight, sec: e.rx?.sec ?? slot.sec, repsMin: undefined })

interface Props {
  p: Profile
  s: ActiveSession
  ei: number
  next: { ei: number; si: number } | null
  collapsed: boolean
  onExpand: () => void
  onMenu: () => void
}

export default function ExerciseCard({ p, s, ei, next, collapsed, onExpand, onMenu }: Props) {
  const { settings } = p
  const { lang, logRef, oneRmFormula } = settings
  const L = (k: Key) => t(lang, k)
  const e = s.entries[ei]
  const [menu, setMenu] = useState<number | null>(null)
  const mode = entryMode(e)
  const name = exerciseName(exerciseById(e.exId), lang)
  const works = e.sets.filter(x => !x.warmup)
  const doneCount = works.filter(x => x.done).length
  const ref = refEntry(exerciseHistory(p.workouts, e.exId, s.start), logRef, oneRmFormula)
  const refText = setText(ref && topSet(ref), settings)
  const note = p.exNotes[e.exId]

  const deleteSet = (si: number) => {
    const before = s.entries
    updateActive(x => removeSet(x, ei, si))
    toast(L('setDeleted'), { label: L('undo'), run: () => updateActive(x => ({ ...x, entries: before })) })
  }

  if (collapsed) {
    return (
      <section className={`card ex-card collapsed${e.sg ? ' in-sg' : ''}`} data-ei={ei}>
        <button type="button" className="ex-collapsed" aria-expanded={false} onClick={onExpand}>
          <Check size={18} />
          <b>{name}</b>
          <span className="muted">{doneCount}/{works.length}</span>
          <ChevronDown size={18} />
        </button>
      </section>
    )
  }

  return (
    <section className={`card ex-card${e.sg ? ' in-sg' : ''}${ei === s.cur ? ' cur' : ''}`} data-ei={ei}>
      <header className="ex-head">
        <div className="ex-title">
          <h2>{name}{e.sg && <span className="badge sg-badge"><Link2 size={12} />{L('superset')}</span>}</h2>
          {e.target && e.rx && (
            <p className="muted ex-rx">
              {slotSummary(planned(e, e.target), settings)}
              {e.rx.why && e.rx.why !== 'first' && <> · <span className="why">{L(WHY_KEY[e.rx.why])}</span></>}
            </p>
          )}
          {refText && <p className="muted">{L(logRef === 'best' ? 'refBest' : 'refLast')}: {refText}</p>}
          {e.target?.side && mode === 'reps' && <p className="muted">{L('sideHint')}</p>}
          {e.target?.note && <p className="ex-note">{e.target.note}</p>}
          {note && <p className="ex-note">{note}</p>}
        </div>
        <button type="button" className="icon-btn" aria-label={`${L('exMenu')}: ${name}`} onClick={onMenu}><MoreVertical size={20} /></button>
      </header>

      {e.sets.map((row, si) => (
        <SetRowView
          key={si} p={p} s={s} ei={ei} si={si} row={row} mode={mode} slot={e.target} label={rowLabel(e.sets, si)}
          isNext={next?.ei === ei && next.si === si}
          onMenu={() => setMenu(si)} onDelete={() => deleteSet(si)}
        />
      ))}

      <button type="button" className="btn small ghost add-set" onClick={() => updateActive(x => addSet(x, ei))}><Plus size={16} />{L('addSet')}</button>

      {menu != null && e.sets[menu] && <SetMenu p={p} s={s} ei={ei} si={menu} onClose={() => setMenu(null)} onDelete={() => deleteSet(menu)} />}
    </section>
  )
}

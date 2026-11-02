import { useState } from 'react'
import { Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { t, type Key } from '../../i18n'
import Sheet from '../../app/Sheet'
import { addRow, cleanEntries, deleteWorkout, newEntry, patchRow, saveWorkout, swapEntry, timeOf, workoutTimes } from '../../app/records'
import { entryMode, workoutMinutes } from '../../app/session'
import { updateProfile } from '../../app/store'
import { toast } from '../../app/toast'
import { exerciseById, exerciseName } from '../../catalogue'
import { isoDate } from '../../core/history'
import type { Entry, Profile, SetRow, Workout } from '../../core/types'
import ExercisePicker from '../plan/ExercisePicker'
import NumInput from '../workout/NumInput'

function rowLabel(sets: SetRow[], si: number) {
  if (sets[si].warmup) return 'W'
  return String(sets.slice(0, si + 1).filter(x => !x.warmup).length)
}

export default function WorkoutEditor({ p, initial, isNew, onClose }: { p: Profile; initial: Workout; isNew: boolean; onClose: () => void }) {
  const { lang, unit } = p.settings
  const L = (k: Key) => t(lang, k)
  const [name, setName] = useState(initial.name)
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(timeOf(initial.start))
  const [minutes, setMinutes] = useState<number | undefined>(workoutMinutes(initial))
  const [note, setNote] = useState(initial.note ?? '')
  const [entries, setEntries] = useState<Entry[]>(initial.entries)
  const [picking, setPicking] = useState<'add' | number | null>(null)
  const today = isoDate(new Date())

  const patchEntry = (ei: number, fn: (e: Entry) => Entry) => setEntries(list => list.map((e, i) => (i === ei ? fn(e) : e)))
  const patchSet = (ei: number, si: number, fn: (s: SetRow) => SetRow) => patchEntry(ei, e => ({ ...e, sets: e.sets.map((s, j) => (j === si ? fn(s) : s)) }))

  const submit = () => {
    if (!date || date > today) {
      toast(L('dateBad'))
      return
    }
    const clean = cleanEntries(entries)
    if (clean.length === 0) {
      toast(L('noSetsYet'))
      return
    }
    const { start, end } = workoutTimes(date, time, minutes ?? 0)
    const saved: Workout = { ...initial, name: name.trim() || initial.name, date, start, end, entries: clean }
    const text = note.trim()
    if (text) saved.note = text
    else delete saved.note
    onClose()
    updateProfile(x => saveWorkout(x, saved))
    toast(L('workoutSaved'), { label: L('undo'), run: () => updateProfile(x => (isNew ? deleteWorkout(x, saved.id) : saveWorkout(x, initial))) })
  }

  return (
    <Sheet onClose={onClose} label={L(isNew ? 'addPast' : 'editWorkout')} className="form workout-editor" onSubmit={submit}>
      <header className="sheet-head">
        <h2>{L(isNew ? 'addPast' : 'editWorkout')}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={L('close')}><X size={20} /></button>
      </header>

      <label>{L('name')}<input className="input" value={name} maxLength={80} data-edit-name onChange={e => setName(e.target.value)} /></label>
      <div className="form-grid">
        <label>{L('date')}<input className="input" type="date" required max={today} value={date} data-edit-date onChange={e => setDate(e.target.value)} /></label>
        <label>{L('startTime')}<input className="input" type="time" value={time} data-edit-time onChange={e => setTime(e.target.value)} /></label>
        <label>{L('durationMin')}<NumInput integer value={minutes} onChange={setMinutes} label={L('durationMin')} /></label>
      </div>

      {entries.map((e, ei) => {
        const mode = entryMode(e)
        const ex = exerciseName(exerciseById(e.exId), lang)
        return (
          <fieldset key={ei} className="edit-entry">
            <legend>{ex}</legend>
            <div className="edit-entry-tools">
              <button type="button" className="icon-btn" aria-label={`${L('swapEx')}: ${ex}`} onClick={() => setPicking(ei)}><RefreshCw size={16} /></button>
              <button type="button" className="icon-btn" aria-label={`${L('removeEx')}: ${ex}`} onClick={() => setEntries(list => list.filter((_, i) => i !== ei))}><Trash2 size={16} /></button>
            </div>
            {e.sets.map((s, si) => (
              <div key={si}>
                <div className="edit-set" data-edit-set>
                  <button
                    type="button" className={`edit-no${s.warmup ? ' on' : ''}`} aria-pressed={!!s.warmup} aria-label={L('setWarmup')}
                    onClick={() => patchSet(ei, si, x => ({ ...x, warmup: !x.warmup || undefined }))}
                  >{rowLabel(e.sets, si)}</button>
                  {mode === 'cardio' ? (
                    <><NumInput value={s.min} onChange={v => patchSet(ei, si, x => patchRow(x, { min: v }))} label={L('minutes')} /><span>{L('minShort')}</span></>
                  ) : (
                    <>
                      <NumInput value={s.w} onChange={v => patchSet(ei, si, x => patchRow(x, { w: v }))} label={L('weightLabel')} placeholder={unit} />
                      <span>×</span>
                      {mode === 'time'
                        ? <><NumInput integer value={s.sec} onChange={v => patchSet(ei, si, x => patchRow(x, { sec: v }))} label={L('seconds')} /><span>{L('secShort')}</span></>
                        : <NumInput integer value={s.r} onChange={v => patchSet(ei, si, x => patchRow(x, { r: v }))} label={L('repsTop')} />}
                    </>
                  )}
                  <button type="button" className="icon-btn" aria-label={L('remove')} onClick={() => patchEntry(ei, x => ({ ...x, sets: x.sets.filter((_, j) => j !== si) }))}><X size={16} /></button>
                </div>
                {s.drops?.map((d, di) => (
                  <div key={di} className="edit-set drop">
                    <span className="edit-no ghost">↓</span>
                    <NumInput value={d.w} onChange={v => patchSet(ei, si, x => ({ ...x, drops: x.drops?.map((y, k) => (k === di ? { ...y, w: v ?? 0 } : y)) }))} label={L('weightLabel')} placeholder={unit} />
                    <span>×</span>
                    <NumInput integer value={d.r} onChange={v => patchSet(ei, si, x => ({ ...x, drops: x.drops?.map((y, k) => (k === di ? { ...y, r: v ?? 0 } : y)) }))} label={L('repsTop')} />
                    <button type="button" className="icon-btn" aria-label={L('remove')} onClick={() => patchSet(ei, si, x => ({ ...x, drops: x.drops?.filter((_, k) => k !== di) }))}><X size={16} /></button>
                  </div>
                ))}
              </div>
            ))}
            <button type="button" className="btn small ghost" onClick={() => patchEntry(ei, addRow)}><Plus size={16} />{L('addSet')}</button>
          </fieldset>
        )
      })}

      <button type="button" className="btn small" data-edit-add-ex onClick={() => setPicking('add')}><Plus size={16} />{L('addExercise')}</button>

      <label>{L('sessionNote')}<textarea className="input" rows={2} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></label>

      <div className="row between finish-actions">
        <button type="button" className="btn" onClick={onClose}>{L('cancel')}</button>
        <button type="submit" className="btn primary" data-edit-save>{L('save')}</button>
      </div>

      {picking != null && (
        <ExercisePicker
          onClose={() => setPicking(null)}
          onPick={x => {
            const at = picking
            setPicking(null)
            if (at === 'add') setEntries(list => [...list, newEntry(x.id)])
            else patchEntry(at, e => swapEntry(e, x.id))
          }}
        />
      )}
    </Sheet>
  )
}

import { useRef, useState, type PointerEvent } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, GripVertical, Link2, Plus, Settings2, Trash2, Unlink } from 'lucide-react'
import { t, type Key } from '../../i18n'
import { useCustomExercises, slotLevels } from '../../app/routineMap'
import { moveItem, newSlot, normalizeSupersets, toggleSuperset } from '../../app/slots'
import { slotSummary } from '../../app/slotText'
import { upsert, useProfile } from '../../app/store'
import { toast } from '../../app/toast'
import BodyMap from '../../catalogue/BodyMap'
import { exerciseById, exerciseName } from '../../catalogue'
import type { Policy, Routine, Slot } from '../../core/types'
import { allowedPolicies } from '../../core/progression'
import ExercisePicker from './ExercisePicker'
import SlotSheet, { POLICY_LABEL } from './SlotSheet'

export default function RoutineEditor({ id }: { id: string }) {
  const p = useProfile()
  const { settings, customEx } = p
  const { lang, body } = settings
  const L = (k: Key) => t(lang, k)
  useCustomExercises(customEx)
  const routine = p.routines.find(r => r.id === id)
  const [picking, setPicking] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null)
  const list = useRef<HTMLOListElement>(null)

  if (!routine) {
    return (
      <div className="card empty">
        <p>{L('routineNotFound')}</p>
        <div className="row center"><a className="btn" href="#/plan/routines">{L('backToPlan')}</a></div>
      </div>
    )
  }

  const save = (patch: Partial<Routine>) => upsert('routines', { ...routine, ...patch })
  const setEx = (ex: Slot[]) => save({ ex: normalizeSupersets(ex) })

  const removeSlot = (i: number) => {
    const before = routine
    setEx(routine.ex.filter((_, n) => n !== i))
    toast(L('exRemoved'), { label: L('undo'), run: () => upsert('routines', before) })
  }

  const overIndex = (y: number, from: number) => {
    const items = [...(list.current?.children ?? [])]
    let gap = items.findIndex(el => {
      const r = el.getBoundingClientRect()
      return y < r.top + r.height / 2
    })
    if (gap < 0) gap = items.length
    return gap > from ? gap - 1 : gap
  }
  const onHandleDown = (i: number, e: PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ from: i, over: i })
  }
  const onHandleMove = (e: PointerEvent) => {
    if (drag) setDrag({ ...drag, over: overIndex(e.clientY, drag.from) })
  }
  const onHandleUp = () => {
    if (drag && drag.from !== drag.over) setEx(moveItem(routine.ex, drag.from, drag.over))
    setDrag(null)
  }

  return (
    <>
      <a className="back-link" href="#/plan/routines"><ArrowLeft size={18} />{L('backToPlan')}</a>
      <section className="card routine-head">
        <div className="routine-fields">
          <label className="field grow">
            {L('name')}
            <input className="input" value={routine.name} maxLength={80} onChange={e => save({ name: e.target.value })} />
          </label>
          <label className="field glyph-field">
            {L('glyph')}
            <input className="input" value={routine.glyph ?? ''} maxLength={3} onChange={e => save({ glyph: e.target.value || undefined })} />
          </label>
          <label className="field grow">
            {L('progRule')}
            <select className="input" value={routine.prog ?? 'off'} onChange={e => save({ prog: e.target.value as Policy })}>
              {allowedPolicies('reps').map(x => <option key={x} value={x}>{L(POLICY_LABEL[x])}</option>)}
            </select>
          </label>
        </div>
        <BodyMap levels={slotLevels(routine.ex)} figure={body} className="mini-map" label={L('muscleMap')} />
      </section>

      {routine.ex.length === 0 && <div className="card empty">{L('routineEmpty')}</div>}

      <ol className="slot-list" ref={list}>
        {routine.ex.map((s, i) => {
          const next = routine.ex[i + 1]
          const linked = !!s.sg && s.sg === next?.sg
          const inGroup = !!s.sg
          const cls = [
            'slot',
            inGroup ? 'in-sg' : '',
            drag?.from === i ? 'dragging' : '',
            drag && drag.over === i && drag.from !== i ? (drag.over < drag.from ? 'drop-before' : 'drop-after') : '',
          ].filter(Boolean).join(' ')
          return (
            <li key={`${s.exId}-${i}`} className={cls}>
              <div className="slot-main">
                <span
                  className="drag-handle" title={L('reorder')} aria-hidden="true"
                  onPointerDown={e => onHandleDown(i, e)} onPointerMove={onHandleMove} onPointerUp={onHandleUp} onPointerCancel={() => setDrag(null)}
                >
                  <GripVertical size={18} />
                </span>
                <button type="button" className="slot-open" onClick={() => setEditing(i)}>
                  <b>{exerciseName(exerciseById(s.exId), lang)}</b>
                  <span className="muted">{slotSummary(s, settings)}{inGroup ? ` · ${L('superset')}` : ''}</span>
                </button>
                <button type="button" className="icon-btn" disabled={i === 0} aria-label={L('moveUp')} onClick={() => setEx(moveItem(routine.ex, i, i - 1))}><ArrowUp size={16} /></button>
                <button type="button" className="icon-btn" disabled={!next} aria-label={L('moveDown')} onClick={() => setEx(moveItem(routine.ex, i, i + 1))}><ArrowDown size={16} /></button>
                <button type="button" className="icon-btn" aria-label={L('slotSetup')} onClick={() => setEditing(i)}><Settings2 size={16} /></button>
                <button type="button" className="icon-btn" aria-label={L('remove')} onClick={() => removeSlot(i)}><Trash2 size={16} /></button>
              </div>
              {next && (
                <button type="button" className={`link-btn${linked ? ' on' : ''}`} aria-pressed={linked} onClick={() => save({ ex: toggleSuperset(routine.ex, i) })}>
                  {linked ? <Unlink size={14} /> : <Link2 size={14} />}
                  {L(linked ? 'unlinkSuperset' : 'linkSuperset')}
                </button>
              )}
            </li>
          )
        })}
      </ol>

      <button type="button" className="btn primary add-slot" onClick={() => setPicking(true)}><Plus size={18} />{L('addExercise')}</button>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={e => {
            setEx([...routine.ex, newSlot(e.id, e.c)])
            setPicking(false)
          }}
        />
      )}
      {editing != null && routine.ex[editing] && (
        <SlotSheet
          slot={routine.ex[editing]}
          onClose={() => setEditing(null)}
          onSave={slot => {
            setEx(routine.ex.map((x, n) => (n === editing ? { ...slot, sg: x.sg } : x)))
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

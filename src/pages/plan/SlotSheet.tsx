import { useState, type ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import { t, type Key } from '../../i18n'
import Sheet from '../../app/Sheet'
import { MAX_SUBS, formatPyramid, parsePyramid, sanitizeSlot } from '../../app/slots'
import { useSettings } from '../../app/store'
import { exerciseById, exerciseName } from '../../catalogue'
import { allowedPolicies, modeOf } from '../../core/progression'
import type { Intensifier, Mode, Policy, Slot } from '../../core/types'
import { defaultIncrement } from '../../core/units'
import ExercisePicker from './ExercisePicker'

export const POLICY_LABEL: Record<Policy, Key> = {
  off: 'polOff', linear: 'polLinear', greyskull: 'polGreyskull', double: 'polDouble', triple: 'polTriple', time: 'polTime',
}

function Num({ label, value, onChange, placeholder }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; placeholder?: string }) {
  return (
    <label>
      {label}
      <input
        className="input" type="number" inputMode="decimal" min={0} step="any" value={value ?? ''} placeholder={placeholder}
        onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
    </label>
  )
}

function Check({ label, checked, onChange, children }: { label: string; checked: boolean; onChange: (v: boolean) => void; children?: ReactNode }) {
  return (
    <label className="check-row">
      <input type="checkbox" className="switch" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span>{label}</span>
      {children}
    </label>
  )
}

function Seg<T extends string>({ label, value, options, onPick }: { label: string; value: T; options: [T, string][]; onPick: (v: T) => void }) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="seg" role="radiogroup" aria-label={label}>
        {options.map(([v, l]) => (
          <button type="button" key={v} role="radio" aria-checked={v === value} className={v === value ? 'on' : ''} onClick={() => onPick(v)}>{l}</button>
        ))}
      </div>
    </fieldset>
  )
}

interface Props {
  slot: Slot
  onSave: (slot: Slot) => void
  onClose: () => void
}

export default function SlotSheet({ slot, onSave, onClose }: Props) {
  const { lang, unit } = useSettings()
  const L = (k: Key) => t(lang, k)
  const [d, setD] = useState<Slot>(slot)
  const [pyramid, setPyramid] = useState(formatPyramid(slot.pyramid))
  const [picking, setPicking] = useState(false)
  const patch = (x: Partial<Slot>) => setD(cur => ({ ...cur, ...x }))
  const mode = modeOf(d)
  const ex = exerciseById(d.exId)
  const subs = d.subs ?? []

  const setMode = (m: Mode) => {
    const next: Partial<Slot> = { mode: m }
    if (m === 'time') Object.assign(next, { sec: d.sec ?? 30, prog: d.prog && allowedPolicies('time').includes(d.prog) ? d.prog : undefined })
    if (m === 'cardio') Object.assign(next, { min: d.min ?? 10, prog: 'off' })
    if (m === 'reps') Object.assign(next, { reps: d.reps || 10, sec: undefined, min: undefined, speed: undefined, incline: undefined, prog: d.prog === 'time' ? undefined : d.prog })
    patch(next)
  }

  const load = d.assisted ? 'assisted' : d.bodyweight ? 'bw' : 'weight'

  return (
    <Sheet
      onClose={onClose} label={L('slotSetup')} className="form slot-sheet"
      onSubmit={() => onSave(sanitizeSlot({ ...d, pyramid: parsePyramid(pyramid) }))}
    >
      <header className="sheet-head">
        <h2>{exerciseName(ex, lang)}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={L('close')}><X size={20} /></button>
      </header>

      <Seg<Mode> label={L('slotMode')} value={mode} onPick={setMode} options={[['reps', L('modeReps')], ['time', L('modeTime')], ['cardio', L('modeCardio')]]} />

      <div className="form-grid">
        {mode !== 'cardio' && <Num label={L('sets')} value={d.sets} onChange={v => patch({ sets: v ?? 0 })} />}
        {mode === 'reps' && <Num label={L('repsTop')} value={d.reps} onChange={v => patch({ reps: v ?? 0 })} />}
        {mode === 'reps' && <Num label={L('repsBottom')} value={d.repsMin} onChange={v => patch({ repsMin: v })} />}
        {mode === 'time' && <Num label={L('seconds')} value={d.sec} onChange={v => patch({ sec: v })} />}
        {mode === 'cardio' && <Num label={L('minutes')} value={d.min} onChange={v => patch({ min: v })} />}
        {mode === 'cardio' && <Num label={L('speed')} value={d.speed} onChange={v => patch({ speed: v })} />}
        {mode === 'cardio' && <Num label={L('incline')} value={d.incline} onChange={v => patch({ incline: v })} />}
        {mode !== 'cardio' && <Num label={`${L('weightLabel')}, ${unit}`} value={d.weight} onChange={v => patch({ weight: v ?? 0 })} />}
        {mode === 'reps' && <Num label={L('warmups')} value={d.warmups} onChange={v => patch({ warmups: v })} />}
        {!d.restOff && <Num label={L('restSlot')} value={d.restSec} onChange={v => patch({ restSec: v })} />}
      </div>

      {mode !== 'cardio' && (
        <Seg
          label={L('loadType')} value={load}
          onPick={v => patch({ bodyweight: v === 'bw' || undefined, assisted: v === 'assisted' || undefined })}
          options={[['weight', L('loadWeight')], ['bw', L('loadBw')], ['assisted', L('loadAssisted')]]}
        />
      )}

      <div className="form-grid">
        <label>
          {L('progRule')}
          <select className="input" value={d.prog ?? ''} onChange={e => patch({ prog: (e.target.value || undefined) as Policy | undefined })}>
            <option value="">{L('polInherit')}</option>
            {allowedPolicies(mode).map(x => <option key={x} value={x}>{L(POLICY_LABEL[x])}</option>)}
          </select>
        </label>
        {mode === 'reps' && <Num label={`${L('incStep')}, ${unit}`} value={d.inc} onChange={v => patch({ inc: v })} placeholder={String(defaultIncrement(unit, ex?.p[0]))} />}
        {d.prog === 'triple' && <Num label={L('setsMax')} value={d.setsMax} onChange={v => patch({ setsMax: v })} />}
      </div>

      {mode === 'reps' && (
        <>
          <Seg<Intensifier | 'none'>
            label={L('intensifier')} value={d.intensifier ?? 'none'}
            onPick={v => patch({ intensifier: v === 'none' ? undefined : v })}
            options={[['none', L('none')], ['dropset', L('dropset')], ['restpause', L('restpause')]]}
          />
          {d.intensifier === 'dropset' && (
            <div className="form-grid">
              <Num label={L('dropCount')} value={d.dropCount ?? 2} onChange={v => patch({ dropCount: v })} />
              <Num label={L('dropPct')} value={d.dropPct ?? 20} onChange={v => patch({ dropPct: v })} />
            </div>
          )}
          <label>
            {L('pyramid')}
            <input className="input" value={pyramid} placeholder={L('pyramidHint')} onChange={e => setPyramid(e.target.value)} />
          </label>
        </>
      )}

      <div className="checks">
        <Check label={L('perSide')} checked={!!d.side} onChange={v => patch({ side: v || undefined })} />
          {d.side && <p className="muted">{L('sideHint')}</p>}
        <Check label={L('restOff')} checked={!!d.restOff} onChange={v => patch({ restOff: v || undefined })} />
      </div>

      <fieldset>
        <legend>{L('backups')}</legend>
        <ul className="sub-list">
          {subs.map(id => (
            <li key={id}>
              <span>{exerciseName(exerciseById(id), lang)}</span>
              <button type="button" className="icon-btn" aria-label={L('remove')} onClick={() => patch({ subs: subs.filter(x => x !== id) })}><X size={16} /></button>
            </li>
          ))}
        </ul>
        {subs.length < MAX_SUBS && (
          <button type="button" className="btn small" onClick={() => setPicking(true)}><Plus size={16} />{L('addExercise')}</button>
        )}
      </fieldset>

      <label>
        {L('note')}
        <textarea className="input" rows={2} maxLength={500} value={d.note ?? ''} onChange={e => patch({ note: e.target.value })} />
      </label>

      <div className="row">
        <button type="submit" className="btn primary">{L('save')}</button>
        <button type="button" className="btn" onClick={onClose}>{L('cancel')}</button>
      </div>

      {picking && (
        <ExercisePicker
          exclude={[d.exId, ...subs]}
          onClose={() => setPicking(false)}
          onPick={e => {
            patch({ subs: [...subs, e.id] })
            setPicking(false)
          }}
        />
      )}
    </Sheet>
  )
}

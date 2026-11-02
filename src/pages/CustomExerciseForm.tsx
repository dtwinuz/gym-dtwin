import { useState } from 'react'
import { t } from '../i18n'
import { getProfile, updateProfile, upsert, useSettings } from '../app/store'
import { deleteItem, upsertItem } from '../app/profile'
import Sheet from '../app/Sheet'
import { toast } from '../app/toast'
import type { CustomExercise } from '../core/types'
import { CATEGORIES, CATEGORY_NAME, EQUIPMENT, EQUIPMENT_NAME, GROUPS, GROUP_NAME, MUSCLE_NAME } from '../catalogue/labels'

const GROUP_OF: Record<string, string> = {
  chest: 'chest', lats: 'back', 'middle back': 'back', 'lower back': 'back', traps: 'back', shoulders: 'shoulders',
  biceps: 'arms', triceps: 'arms', forearms: 'arms', quadriceps: 'legs', hamstrings: 'legs', glutes: 'legs',
  calves: 'legs', adductors: 'legs', abductors: 'legs', abdominals: 'core', neck: 'neck',
}

interface Props {
  initial: CustomExercise | null
  onClose: () => void
  onDeleted?: () => void
}

export default function CustomExerciseForm({ initial, onClose, onDeleted }: Props) {
  const { lang } = useSettings()
  const [x, setX] = useState<CustomExercise>(initial ?? {
    id: '', name: '', bodyPart: 'chest', equipment: 'barbell', primary: ['chest'], secondary: [], category: 'strength',
  })

  const save = () => {
    const name = x.name.trim()
    if (!name) return
    const id = x.id || `custom-${Date.now().toString(36)}`
    upsert('customEx', { ...x, id, name, bodyPart: GROUP_OF[x.primary[0]] ?? x.bodyPart })
    onClose()
  }

  const remove = () => {
    const row = getProfile().customEx.find(c => c.id === x.id)
    if (!row) return onClose()
    const wasFav = getProfile().favEx.includes(row.id)
    updateProfile(p => ({ ...deleteItem(p, 'customEx', row.id), favEx: p.favEx.filter(f => f !== row.id) }))
    toast(t(lang, 'exDeleted'), {
      label: t(lang, 'undo'),
      run: () => updateProfile(p => {
        const back = upsertItem(p, 'customEx', row)
        return wasFav && !back.favEx.includes(row.id) ? { ...back, favEx: [...back.favEx, row.id] } : back
      }),
    })
    onClose()
    onDeleted?.()
  }

  const toggleSecondary = (m: string) =>
    setX(v => ({ ...v, secondary: v.secondary.includes(m) ? v.secondary.filter(y => y !== m) : [...v.secondary, m] }))

  const primary = x.primary[0]

  return (
    <Sheet onClose={onClose} label={initial ? x.name || t(lang, 'edit') : t(lang, 'newExercise')} className="form" onSubmit={save}>
      <h2>{initial ? x.name : t(lang, 'newExercise')}</h2>
      <label>{t(lang, 'name')}
        <input className="input" value={x.name} onChange={e => setX({ ...x, name: e.target.value })} required autoFocus maxLength={80} />
      </label>
      <label>{t(lang, 'primaryOne')}
        <select className="input" value={primary ?? ''} onChange={e => setX({ ...x, primary: [e.target.value], secondary: x.secondary.filter(m => m !== e.target.value) })}>
          {!primary && <option value="">{GROUP_NAME.other[lang]}</option>}
          {Object.keys(MUSCLE_NAME).map(m => <option key={m} value={m}>{MUSCLE_NAME[m][lang]}</option>)}
        </select>
      </label>
      <fieldset>
        <legend>{t(lang, 'secondary')}</legend>
        <div className="chips">
          {Object.keys(MUSCLE_NAME).filter(m => m !== primary).map(m => (
            <button type="button" key={m} className={x.secondary.includes(m) ? 'on' : ''} aria-pressed={x.secondary.includes(m)} onClick={() => toggleSecondary(m)}>{MUSCLE_NAME[m][lang]}</button>
          ))}
        </div>
      </fieldset>
      <label>{t(lang, 'equipment')}
        <select className="input" value={x.equipment} onChange={e => setX({ ...x, equipment: e.target.value })}>
          {EQUIPMENT.map(m => <option key={m} value={m}>{EQUIPMENT_NAME[m][lang]}</option>)}
        </select>
      </label>
      <label>{t(lang, 'category')}
        <select className="input" value={x.category} onChange={e => setX({ ...x, category: e.target.value })}>
          {CATEGORIES.map(m => <option key={m} value={m}>{CATEGORY_NAME[m][lang]}</option>)}
        </select>
      </label>
      <p className="muted">{t(lang, 'muscleGroup')}: {GROUP_NAME[(GROUP_OF[primary] ?? 'other') as (typeof GROUPS)[number]]?.[lang]}</p>
      <div className="row">
        <button type="submit" className="btn primary">{t(lang, 'save')}</button>
        <button type="button" className="btn" onClick={onClose}>{t(lang, 'cancel')}</button>
        {initial && <button type="button" className="btn danger" onClick={remove}>{t(lang, 'remove')}</button>}
      </div>
    </Sheet>
  )
}

import { useState } from 'react'
import { t } from '../i18n'
import { update, useStore, type CustomEx } from '../store'
import { CATEGORIES, CATEGORY_NAME, EQUIPMENT, EQUIPMENT_NAME, GROUPS, GROUP_NAME, MUSCLE_NAME } from '../catalogue/labels'

const GROUP_OF: Record<string, string> = {
  chest: 'chest', lats: 'back', 'middle back': 'back', 'lower back': 'back', traps: 'back', shoulders: 'shoulders',
  biceps: 'arms', triceps: 'arms', forearms: 'arms', quadriceps: 'legs', hamstrings: 'legs', glutes: 'legs',
  calves: 'legs', adductors: 'legs', abductors: 'legs', abdominals: 'core', neck: 'neck',
}

export default function CustomExerciseForm({ initial, onClose }: { initial: CustomEx | null; onClose: () => void }) {
  const { lang } = useStore()
  const [x, setX] = useState<CustomEx>(initial ?? { id: '', n: '', g: 'chest', eq: 'barbell', p: ['chest'], s: [], c: 'strength' })

  const save = () => {
    const n = x.n.trim()
    if (!n) return
    const id = x.id || `custom-${Date.now().toString(36)}`
    const row = { ...x, id, n, g: GROUP_OF[x.p[0]] ?? x.g }
    update(s => ({ ...s, customEx: [...s.customEx.filter(c => c.id !== id), row] }))
    onClose()
  }

  const remove = () => {
    update(s => ({ ...s, customEx: s.customEx.filter(c => c.id !== x.id), favEx: s.favEx.filter(f => f !== x.id) }))
    location.hash = '#/exercises'
    onClose()
  }

  const toggleSecondary = (m: string) =>
    setX(v => ({ ...v, s: v.s.includes(m) ? v.s.filter(y => y !== m) : [...v.s, m] }))

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form
        className="sheet form" role="dialog" aria-modal="true" aria-label={t(lang, 'newExercise')}
        onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); save() }}
      >
        <h2>{initial ? x.n : t(lang, 'newExercise')}</h2>
        <label>{t(lang, 'name')}
          <input className="input" value={x.n} onChange={e => setX({ ...x, n: e.target.value })} required autoFocus maxLength={80} />
        </label>
        <label>{t(lang, 'primaryOne')}
          <select className="input" value={x.p[0]} onChange={e => setX({ ...x, p: [e.target.value], s: x.s.filter(m => m !== e.target.value) })}>
            {Object.keys(MUSCLE_NAME).map(m => <option key={m} value={m}>{MUSCLE_NAME[m][lang]}</option>)}
          </select>
        </label>
        <fieldset>
          <legend>{t(lang, 'secondary')}</legend>
          <div className="chips">
            {Object.keys(MUSCLE_NAME).filter(m => m !== x.p[0]).map(m => (
              <button type="button" key={m} className={x.s.includes(m) ? 'on' : ''} onClick={() => toggleSecondary(m)}>{MUSCLE_NAME[m][lang]}</button>
            ))}
          </div>
        </fieldset>
        <label>{t(lang, 'equipment')}
          <select className="input" value={x.eq} onChange={e => setX({ ...x, eq: e.target.value })}>
            {EQUIPMENT.map(m => <option key={m} value={m}>{EQUIPMENT_NAME[m][lang]}</option>)}
          </select>
        </label>
        <label>{t(lang, 'category')}
          <select className="input" value={x.c} onChange={e => setX({ ...x, c: e.target.value })}>
            {CATEGORIES.map(m => <option key={m} value={m}>{CATEGORY_NAME[m][lang]}</option>)}
          </select>
        </label>
        <p className="muted">{t(lang, 'muscleGroup')}: {GROUP_NAME[(GROUP_OF[x.p[0]] ?? 'other') as (typeof GROUPS)[number]]?.[lang]}</p>
        <div className="row">
          <button type="submit" className="btn primary">{t(lang, 'save')}</button>
          <button type="button" className="btn" onClick={onClose}>{t(lang, 'cancel')}</button>
          {initial && <button type="button" className="btn danger" onClick={remove}>{t(lang, 'remove')}</button>}
        </div>
      </form>
    </div>
  )
}

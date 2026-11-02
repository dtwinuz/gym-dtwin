import { X } from 'lucide-react'
import { t, type Key } from '../i18n'
import { fmtNum } from '../app/format'
import { updateProfile, useProfile } from '../app/store'
import { exerciseById, exerciseName } from '../catalogue'
import { BAR_DEFAULTS, PLATE_SIZES, defaultPlates } from '../core/plates'
import NumInput from './workout/NumInput'

const BARS: [Key, string][] = [['barOlympic', 'barbell'], ['barEz', 'ez bar'], ['barTrap', 'trap bar'], ['barSmith', 'smith']]

export function OwnedPlates() {
  const { settings: { lang, unit }, plates } = useProfile()
  const owned = plates[unit] ?? defaultPlates(unit)
  const set = (size: number, n: number | undefined) => updateProfile(p => {
    const next = { ...(p.plates[unit] ?? defaultPlates(unit)) }
    if (n) next[size] = n
    else delete next[size]
    return { ...p, plates: { ...p.plates, [unit]: next } }
  })
  return (
    <div className="plate-grid">
      {PLATE_SIZES[unit].map(size => (
        <label key={size}>
          <span>{fmtNum(size, lang, 2)} {unit}</span>
          <NumInput integer value={owned[size] ?? 0} label={`${t(lang, 'platePairs')}: ${size} ${unit}`} onChange={n => set(size, n)} />
        </label>
      ))}
    </div>
  )
}

export function BarWeights() {
  const { settings: { lang, unit }, barWeights } = useProfile()
  const L = (k: Key) => t(lang, k)
  const ids = Object.keys(barWeights)
  const set = (id: string, w: number | undefined) => updateProfile(p => {
    const next = { ...p.barWeights }
    if (w == null) delete next[id]
    else next[id] = w
    return { ...p, barWeights: next }
  })
  return (
    <>
      <p className="muted">{BARS.map(([k, id]) => `${L(k)} ${BAR_DEFAULTS[id][unit]}`).join(' · ')} {unit}</p>
      {ids.length === 0 && <p className="muted">{L('barHint')}</p>}
      <ul className="sub-list bar-list">
        {ids.map(id => (
          <li key={id}>
            <span>{exerciseName(exerciseById(id), lang)}</span>
            <span className="row-tight">
              <NumInput value={barWeights[id]} label={`${L('barWeight')}, ${unit}`} onChange={w => set(id, w ?? 0)} />
              <button type="button" className="icon-btn" aria-label={L('remove')} onClick={() => set(id, undefined)}><X size={16} /></button>
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { t } from '../../i18n'
import Sheet from '../../app/Sheet'
import { useProfile } from '../../app/store'
import { allExercises, exerciseName, type CatalogueExercise } from '../../catalogue'
import { EQUIPMENT_NAME, MUSCLE_NAME, label } from '../../catalogue/labels'
import { buildIndex, search } from '../../catalogue/search'
import { Thumb } from '../Exercises'

const LIMIT = 40

export default function ExercisePicker({ onPick, onClose, exclude = [] }: { onPick: (e: CatalogueExercise) => void; onClose: () => void; exclude?: string[] }) {
  const { settings: { lang }, favEx, workouts } = useProfile()
  const [q, setQ] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.focus({ preventScroll: true }) }, [])
  const dq = useDeferredValue(q)
  const docs = useMemo(() => buildIndex(allExercises()), [])
  const hints = useMemo(() => ({
    fav: new Set(favEx),
    used: new Set(workouts.flatMap(w => w.entries.map(e => e.exId))),
  }), [favEx, workouts])
  const list = useMemo(() => search(docs, dq, hints).filter(e => !exclude.includes(e.id)).slice(0, LIMIT), [docs, dq, hints, exclude])

  return (
    <Sheet onClose={onClose} label={t(lang, 'pickExercise')} className="picker">
      <header className="sheet-head">
        <h2>{t(lang, 'pickExercise')}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t(lang, 'close')}><X size={20} /></button>
      </header>
      <div className="searchbox">
        <Search size={18} />
        <input
          ref={input} className="input" type="search" value={q} placeholder={t(lang, 'searchEx')} aria-label={t(lang, 'searchEx')}
          onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
        />
      </div>
      {list.length === 0 && <p className="empty pad">{t(lang, 'noResults')}</p>}
      <ul className="exlist picker-list">
        {list.map(e => (
          <li key={e.id}>
            <button type="button" className="exrow" onClick={() => onPick(e)}>
              <Thumb e={e} />
              <span className="exrow-text">
                <b>{exerciseName(e, lang)}</b>
                <span className="muted">{label(MUSCLE_NAME, e.p[0] ?? '', lang)} · {label(EQUIPMENT_NAME, e.eq, lang)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

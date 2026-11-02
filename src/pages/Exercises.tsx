import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, SlidersHorizontal, Star, X } from 'lucide-react'
import { t } from '../i18n'
import { updateProfile, useProfile } from '../app/store'
import { customToCatalogue } from '../app/custom'
import type { CustomExercise } from '../core/types'
import { allExercises, exerciseName, imageUrl, setCustomExercises, type CatalogueExercise } from '../catalogue'
import { buildIndex, search } from '../catalogue/search'
import {
  CATEGORIES, CATEGORY_NAME, EQUIPMENT, EQUIPMENT_NAME, GROUPS, GROUP_NAME, LEVELS, LEVEL_NAME, MUSCLE_NAME, label,
} from '../catalogue/labels'
import BodyMap from '../catalogue/BodyMap'
import ExerciseDetail from './ExerciseDetail'
import CustomExerciseForm from './CustomExerciseForm'

const PAGE = 60
const HOME_GEAR = ['bodyweight', 'dumbbell', 'band', 'kettlebell', 'exercise ball', 'foam roll', 'other']

const idFromHash = () => {
  const m = location.hash.match(/^#\/exercises\/(.+)$/)
  return m ? decodeURIComponent(m[1]) : null
}
const exUrl = (id: string) => `#/exercises/${encodeURIComponent(id)}`

export default function Exercises() {
  const { settings: { lang, body: figure }, favEx, customEx, gear, workouts } = useProfile()
  const [q, setQ] = useState('')
  const dq = useDeferredValue(q)
  const [group, setGroup] = useState<string | null>(null)
  const [muscle, setMuscle] = useState<string | null>(null)
  const [eq, setEq] = useState('')
  const [cat, setCat] = useState('')
  const [lvl, setLvl] = useState('')
  const [onlyGear, setOnlyGear] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [mapSide, setMapSide] = useState<'front' | 'back'>('front')
  const [limit, setLimit] = useState(PAGE)
  const [openId, setOpenId] = useState(idFromHash)
  const [editing, setEditing] = useState<CustomExercise | 'new' | null>(null)
  const more = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (idFromHash()) history.replaceState(history.state, '', '#/exercises')
  }, [])

  useEffect(() => {
    const on = () => {
      const id = idFromHash()
      if (id) history.replaceState(history.state, '', '#/exercises')
      setOpenId(id)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const docs = useMemo(() => {
    setCustomExercises(customEx.map(customToCatalogue))
    return buildIndex(allExercises())
  }, [customEx])

  const fav = useMemo(() => new Set(favEx), [favEx])
  const used = useMemo(() => new Set(workouts.flatMap(w => w.entries.map(e => e.exId))), [workouts])

  const list = useMemo(() => {
    const gearSet = onlyGear && gear ? new Set(gear) : null
    return search(docs, dq, { fav, used }).filter(e =>
      (!group || (group === 'fav' ? fav.has(e.id) : group === 'mine' ? e.custom : e.g === group)) &&
      (!muscle || e.p.includes(muscle) || e.s.includes(muscle)) &&
      (!eq || e.eq === eq) && (!cat || e.c === cat) && (!lvl || e.l === lvl) &&
      (!gearSet || gearSet.has(e.eq)))
  }, [docs, dq, fav, used, group, muscle, eq, cat, lvl, onlyGear, gear])

  useEffect(() => setLimit(PAGE), [dq, group, muscle, eq, cat, lvl, onlyGear])

  useEffect(() => {
    const el = more.current
    if (!el) return
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting) setLimit(l => l + PAGE) }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [list.length, limit])

  const toggleFav = (id: string) =>
    updateProfile(p => ({ ...p, favEx: p.favEx.includes(id) ? p.favEx.filter(x => x !== id) : [...p.favEx, id] }))

  const toggleGear = (g: string) =>
    updateProfile(p => {
      const cur = new Set<string>(p.gear ?? EQUIPMENT)
      if (cur.has(g)) cur.delete(g)
      else cur.add(g)
      return { ...p, gear: [...cur] }
    })

  const pickMuscle = (m: string) => setMuscle(cur => (cur === m ? null : m))
  const filtersOn = !!(eq || cat || lvl || onlyGear || muscle)
  const open = (id: string) => setOpenId(id)

  return (
    <>
      <div className="lib-head">
        <h1>{t(lang, 'library')}</h1>
        <button className="btn" onClick={() => setEditing('new')}><Plus size={16} /> {t(lang, 'newExercise')}</button>
      </div>

      <div className="searchbox">
        <Search size={18} />
        <input
          className="input" type="search" placeholder={t(lang, 'searchEx')} value={q}
          onChange={e => setQ(e.target.value)} aria-label={t(lang, 'search')}
        />
        {q && <button className="icon-btn" onClick={() => setQ('')} aria-label={t(lang, 'clear')}><X size={16} /></button>}
        <button className={`icon-btn${showFilters || filtersOn ? ' on' : ''}`} onClick={() => setShowFilters(v => !v)} aria-label={t(lang, 'equipment')}>
          <SlidersHorizontal size={18} />
        </button>
      </div>

      <div className="chips">
        <button className={!group ? 'on' : ''} onClick={() => setGroup(null)}>{t(lang, 'all')}</button>
        <button className={group === 'fav' ? 'on' : ''} onClick={() => setGroup('fav')}><Star size={12} /> {t(lang, 'favorites')}</button>
        {GROUPS.map(g => (
          <button key={g} className={g === group ? 'on' : ''} onClick={() => setGroup(g)}>{GROUP_NAME[g][lang]}</button>
        ))}
        {customEx.length > 0 && <button className={group === 'mine' ? 'on' : ''} onClick={() => setGroup('mine')}>{t(lang, 'mine')}</button>}
        <button className={showMap ? 'on' : ''} onClick={() => setShowMap(v => !v)}>{t(lang, 'muscleMap')}</button>
      </div>

      {showFilters && (
        <div className="card filters">
          <label>{t(lang, 'equipment')}
            <select className="input" value={eq} onChange={e => setEq(e.target.value)}>
              <option value="">{t(lang, 'any')}</option>
              {EQUIPMENT.map(x => <option key={x} value={x}>{EQUIPMENT_NAME[x][lang]}</option>)}
            </select>
          </label>
          <label>{t(lang, 'category')}
            <select className="input" value={cat} onChange={e => setCat(e.target.value)}>
              <option value="">{t(lang, 'any')}</option>
              {CATEGORIES.map(x => <option key={x} value={x}>{CATEGORY_NAME[x][lang]}</option>)}
            </select>
          </label>
          <label>{t(lang, 'level')}
            <select className="input" value={lvl} onChange={e => setLvl(e.target.value)}>
              <option value="">{t(lang, 'any')}</option>
              {LEVELS.map(x => <option key={x} value={x}>{LEVEL_NAME[x][lang]}</option>)}
            </select>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={onlyGear} onChange={e => setOnlyGear(e.target.checked)} /> {t(lang, 'onlyGear')}
          </label>
          <details className="gear">
            <summary>{t(lang, 'myGear')}</summary>
            <p className="muted">{t(lang, 'gearHint')}</p>
            <div className="chips">
              {EQUIPMENT.map(g => (
                <button key={g} className={(gear ?? EQUIPMENT).includes(g) ? 'on' : ''} onClick={() => toggleGear(g)}>{EQUIPMENT_NAME[g][lang]}</button>
              ))}
            </div>
            <div className="row">
              <button className="btn" onClick={() => updateProfile(p => ({ ...p, gear: HOME_GEAR }))}>{t(lang, 'gearHome')}</button>
              <button className="btn" onClick={() => updateProfile(p => ({ ...p, gear: null }))}>{t(lang, 'gearGym')}</button>
            </div>
          </details>
          {filtersOn && (
            <button className="btn" onClick={() => { setEq(''); setCat(''); setLvl(''); setOnlyGear(false); setMuscle(null) }}>{t(lang, 'clear')}</button>
          )}
        </div>
      )}

      {showMap && (
        <div className="card explorer">
          <div className="explorer-head">
            <p className="muted">{t(lang, 'mapHint')}</p>
            <div className="seg">
              <button className={mapSide === 'front' ? 'on' : ''} onClick={() => setMapSide('front')}>{t(lang, 'front')}</button>
              <button className={mapSide === 'back' ? 'on' : ''} onClick={() => setMapSide('back')}>{t(lang, 'back')}</button>
            </div>
          </div>
          <BodyMap levels={muscle ? { [muscle]: 1 } : {}} side={mapSide} figure={figure} selected={muscle} onPick={pickMuscle} className="explorer-map" />
          <div className="chips muscles">
            {Object.keys(MUSCLE_NAME).map(m => (
              <button key={m} className={m === muscle ? 'on' : ''} onClick={() => pickMuscle(m)}>{label(MUSCLE_NAME, m, lang)}</button>
            ))}
          </div>
        </div>
      )}

      <p className="muted count">{list.length} {t(lang, 'found')}{muscle ? ` · ${label(MUSCLE_NAME, muscle, lang)}` : ''}</p>

      {list.length === 0 && <div className="card empty">{t(lang, 'noResults')}</div>}

      <ul className="exlist">
        {list.slice(0, limit).map(e => (
          <li key={e.id}>
            <button className="exrow" onClick={() => open(e.id)}>
              <Thumb e={e} />
              <span className="exrow-text">
                <b>{exerciseName(e, lang)}</b>
                <span className="muted">
                  {label(MUSCLE_NAME, e.p[0] ?? '', lang)} · {label(EQUIPMENT_NAME, e.eq, lang)}
                  {e.custom ? ` · ${t(lang, 'customTag')}` : ''}
                </span>
              </span>
            </button>
            <button
              className={`icon-btn star${fav.has(e.id) ? ' on' : ''}`} onClick={() => toggleFav(e.id)}
              aria-label={t(lang, 'favorites')} aria-pressed={fav.has(e.id)}
            >
              <Star size={18} />
            </button>
          </li>
        ))}
      </ul>
      {limit < list.length && <div ref={more} className="more"><button className="btn" onClick={() => setLimit(l => l + PAGE)}>{t(lang, 'showMore')}</button></div>}

      {openId && (
        <ExerciseDetail
          id={openId}
          url={exUrl(openId)}
          onClose={() => setOpenId(null)}
          onOpen={open}
          onEdit={c => setEditing(c)}
        />
      )}
      {editing && <CustomExerciseForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onDeleted={() => setOpenId(null)} />}
    </>
  )
}

export function Thumb({ e }: { e: CatalogueExercise }) {
  if (!e.i) return <span className={`thumb ph g-${e.g}`}>{(e.n[0] ?? '?').toUpperCase()}</span>
  return (
    <span className="thumb">
      <img src={imageUrl(e.id, 0)} alt="" loading="lazy" decoding="async" width={64} height={64} />
      {e.i > 1 && <img className="alt" src={imageUrl(e.id, 1)} alt="" loading="lazy" decoding="async" width={64} height={64} />}
    </span>
  )
}

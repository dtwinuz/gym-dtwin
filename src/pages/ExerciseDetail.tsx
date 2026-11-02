import { useEffect, useState } from 'react'
import { Pencil, Star, X } from 'lucide-react'
import { t } from '../i18n'
import { e1rm, update, useStore, type CustomEx } from '../store'
import { exerciseById, exerciseName, exerciseSteps, imageUrl, similarExercises } from '../catalogue'
import { CATEGORY_NAME, EQUIPMENT_NAME, LEVEL_NAME, MUSCLE_NAME, label } from '../catalogue/labels'
import BodyMap, { exerciseLevels } from '../catalogue/BodyMap'
import { Thumb } from './Exercises'
import type { Lang } from '../i18n'

interface Props {
  id: string
  onClose: () => void
  onOpen: (id: string) => void
  onEdit: (c: CustomEx) => void
}

export default function ExerciseDetail({ id, onClose, onOpen, onEdit }: Props) {
  const { lang, favEx, workouts, figure, customEx } = useStore()
  const e = exerciseById(id)
  const [steps, setSteps] = useState<{ lang: Lang; steps: string[] } | null>(null)
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    let live = true
    setSteps(null)
    exerciseSteps(id, lang).then(s => live && setSteps(s))
    return () => { live = false }
  }, [id, lang])

  useEffect(() => {
    if (!e || e.i < 2) return
    const timer = setInterval(() => setFrame(f => (f + 1) % e.i), 1400)
    return () => clearInterval(timer)
  }, [e])

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [onClose])

  if (!e) return null
  const fav = favEx.includes(id)
  const sets = workouts.flatMap(w => w.sets.filter(s => s.exId === id).map(s => ({ ...s, date: w.date })))
  const best = sets.reduce<(typeof sets)[number] | null>((b, s) => (!b || e1rm(s.kg, s.reps) > e1rm(b.kg, b.reps) ? s : b), null)
  const sessions = new Set(sets.map(s => s.date)).size
  const custom = customEx.find(c => c.id === id)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label={exerciseName(e, lang)} onClick={ev => ev.stopPropagation()}>
        <header className="sheet-head">
          <h2>{exerciseName(e, lang)}</h2>
          {custom && <button className="icon-btn" onClick={() => onEdit(custom)} aria-label={t(lang, 'save')}><Pencil size={18} /></button>}
          <button
            className={`icon-btn star${fav ? ' on' : ''}`} aria-pressed={fav} aria-label={t(lang, 'favorites')}
            onClick={() => update(s => ({ ...s, favEx: fav ? s.favEx.filter(x => x !== id) : [...s.favEx, id] }))}
          >
            <Star size={18} />
          </button>
          <button className="icon-btn" onClick={onClose} aria-label={t(lang, 'close')}><X size={20} /></button>
        </header>
        {lang !== 'en' && exerciseName(e, lang) !== e.n && <p className="muted alt-name">{e.n}</p>}

        <div className="detail-grid">
          <div>
            {e.i > 0 ? (
              <div className="photo">
                {Array.from({ length: e.i }, (_, n) => (
                  <img key={n} src={imageUrl(e.id, n)} alt="" className={n === frame ? 'on' : ''} />
                ))}
              </div>
            ) : (
              <div className="photo"><Thumb e={e} /></div>
            )}
            <div className="tags">
              <span className="badge">{label(EQUIPMENT_NAME, e.eq, lang)}</span>
              <span className="badge">{label(CATEGORY_NAME, e.c, lang)}</span>
              {e.l && <span className="badge">{label(LEVEL_NAME, e.l, lang)}</span>}
              {e.m && <span className="badge">{t(lang, e.m === 'c' ? 'compound' : 'isolation')}</span>}
            </div>
          </div>
          <div className="muscles-box">
            <BodyMap levels={exerciseLevels(e.p, e.s)} figure={figure} className="detail-map" label={t(lang, 'muscleMap')} />
            <p><b>{t(lang, 'primary')}:</b> {e.p.map(m => label(MUSCLE_NAME, m, lang)).join(', ') || '—'}</p>
            {e.s.length > 0 && <p className="muted"><b>{t(lang, 'secondary')}:</b> {e.s.map(m => label(MUSCLE_NAME, m, lang)).join(', ')}</p>}
          </div>
        </div>

        {(steps?.steps.length ?? 0) > 0 && (
          <>
            <h3 className="sec">{t(lang, 'steps')}</h3>
            {steps!.lang !== lang && t(lang, 'stepsEnOnly') && <p className="muted">{t(lang, 'stepsEnOnly')}</p>}
            <ol className="steps" lang={steps!.lang}>{steps!.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </>
        )}

        <h3 className="sec">{t(lang, 'myHistory')}</h3>
        {best ? (
          <div className="stats">
            <div className="card stat"><b>{best.kg} × {best.reps}</b><span>{t(lang, 'bestSet')}</span></div>
            <div className="card stat"><b>{Math.round(e1rm(best.kg, best.reps))} kg</b><span>{t(lang, 'e1rm')}</span></div>
            <div className="card stat"><b>{sessions}</b><span>{t(lang, 'sessions')}</span></div>
          </div>
        ) : <p className="muted">{t(lang, 'noHistory')}</p>}

        {similarExercises(id).length > 0 && (
          <>
            <h3 className="sec">{t(lang, 'similar')}</h3>
            <div className="similar">
              {similarExercises(id).map(x => (
                <button key={x.id} className="exrow" onClick={() => onOpen(x.id)}>
                  <Thumb e={x} />
                  <span className="exrow-text"><b>{exerciseName(x, lang)}</b><span className="muted">{label(EQUIPMENT_NAME, x.eq, lang)}</span></span>
                </button>
              ))}
            </div>
          </>
        )}
        {e.i > 0 && <p className="muted credit">{t(lang, 'photoCredit')}</p>}
      </section>
    </div>
  )
}

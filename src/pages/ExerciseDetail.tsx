import { useEffect, useState } from 'react'
import { Pencil, Star, X } from 'lucide-react'
import { t } from '../i18n'
import { updateProfile, useProfile } from '../app/store'
import Sheet from '../app/Sheet'
import { fmtNum } from '../app/format'
import { e1rm } from '../core/onerm'
import { formatWeight } from '../core/units'
import type { CustomExercise } from '../core/types'
import { exerciseById, exerciseName, exerciseSteps, imageUrl, similarExercises } from '../catalogue'
import { CATEGORY_NAME, EQUIPMENT_NAME, LEVEL_NAME, MUSCLE_NAME, label } from '../catalogue/labels'
import BodyMap, { exerciseLevels } from '../catalogue/BodyMap'
import { Thumb } from './Exercises'
import type { Lang } from '../i18n'

interface Props {
  id: string
  onClose: () => void
  onOpen: (id: string) => void
  onEdit: (c: CustomExercise) => void
  url?: string
}

export default function ExerciseDetail({ id, onClose, onOpen, onEdit, url }: Props) {
  const { settings: { lang, body: figure, unit, oneRmFormula, wdec }, favEx, workouts, customEx } = useProfile()
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

  if (!e) return null
  const fav = favEx.includes(id)
  const est = (s: { w?: number; r?: number; rir?: number }) => e1rm(s.w ?? 0, s.r ?? 0, oneRmFormula, s.rir)
  const sets = workouts.flatMap(w => w.entries.filter(x => x.exId === id).flatMap(x => x.sets.filter(s => s.done && !s.warmup && (s.r ?? 0) > 0)))
  const best = sets.reduce<(typeof sets)[number] | null>((b, s) => (!b || est(s) > est(b) ? s : b), null)
  const sessions = workouts.filter(w => w.entries.some(x => x.exId === id)).length
  const custom = customEx.find(c => c.id === id)

  return (
    <Sheet onClose={onClose} label={exerciseName(e, lang)} url={url}>
        <header className="sheet-head">
          <h2>{exerciseName(e, lang)}</h2>
          {custom && <button className="icon-btn" onClick={() => onEdit(custom)} aria-label={t(lang, 'edit')}><Pencil size={18} /></button>}
          <button
            className={`icon-btn star${fav ? ' on' : ''}`} aria-pressed={fav} aria-label={t(lang, 'favorites')}
            onClick={() => updateProfile(p => ({ ...p, favEx: fav ? p.favEx.filter(x => x !== id) : [...p.favEx, id] }))}
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
            <div className="card stat"><b>{formatWeight(best.w ?? 0, wdec)} {unit} × {best.r}</b><span>{t(lang, 'bestSet')}</span></div>
            <div className="card stat"><b>{fmtNum(est(best), lang)} {unit}</b><span>{t(lang, 'e1rm')}</span></div>
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
    </Sheet>
  )
}

import { useState, type FormEvent, type ReactNode } from 'react'
import { Check, Flame, Moon, Play, Sun, X } from 'lucide-react'
import { t, type Key } from '../i18n'
import { fmtDate, fmtNum } from '../app/format'
import { addWeighIn, isHeatSeason, nextTraining, todayState, weekStrip, weightTrend, type DayStatus } from '../app/plan'
import { slotLevels, useCustomExercises } from '../app/routineMap'
import { updateProfile, useProfile, useSettings } from '../app/store'
import { toast } from '../app/toast'
import BodyMap from '../catalogue/BodyMap'
import { exerciseById, exerciseName } from '../catalogue'
import { isoDate, weekStreak } from '../core/history'
import { weekTally } from '../core/schedule'
import type { Profile, Routine } from '../core/types'
import Onboarding from './Onboarding'
import ProgramsSheet from './plan/ProgramsSheet'

const STATUS_KEY: Record<DayStatus, Key> = { done: 'stDone', planned: 'stPlanned', missed: 'stMissed', rest: 'stRest' }

function TodayCard({ p, today }: { p: Profile; today: string }) {
  const { lang, body } = p.settings
  const L = (k: Key) => t(lang, k)
  const { routines } = p
  const state = todayState(p, today)
  const planned = state.ids.map(id => routines.find(r => r.id === id)).filter((r): r is Routine => !!r)
  const slots = planned.flatMap(r => r.ex)

  if (state.status === 'train') {
    return (
      <section className="card today-card">
        <div className="today-text">
          <p className="muted">{L('today')}</p>
          <h1>{planned.map(r => r.name).join(' + ')}</h1>
          <p className="muted">{slots.length} {L('exCount')} · {slots.reduce((n, s) => n + s.sets, 0)} {L('setsShort')}</p>
          <p className="today-ex">{slots.slice(0, 6).map(s => exerciseName(exerciseById(s.exId), lang)).join(' · ')}{slots.length > 6 ? ' …' : ''}</p>
          <a className="btn primary big" href={`#/workout?routine=${state.ids.map(encodeURIComponent).join(',')}`}><Play size={20} />{L('start')}</a>
        </div>
        <BodyMap levels={slotLevels(slots)} figure={body} className="today-map" label={L('muscleMap')} />
      </section>
    )
  }

  const next = nextTraining(p, today)
  const nextNames = next?.routineIds.map(id => routines.find(r => r.id === id)?.name ?? '?').join(' + ')
  return (
    <section className="card today-card">
      <div className="today-text">
        <h1>{L(state.status === 'done' ? 'doneToday' : 'restToday')}</h1>
        {next
          ? <p>{L('nextWorkout')}: <b>{fmtDate(next.date, lang, { weekday: 'long', day: 'numeric', month: 'long' })}</b> · {nextNames}</p>
          : <p className="muted">{L('noNextPlanned')}</p>}
        <a className="btn" href="#/plan/routines">{L('extraSession')}</a>
      </div>
    </section>
  )
}

function WeekStrip({ p }: { p: Profile }) {
  const { lang } = p.settings
  const { routines } = p
  const tally = weekTally(p)
  return (
    <section className="card">
      <div className="strip-head">
        <h2>{t(lang, 'thisWeek')}</h2>
        <span className="muted">{tally.planned ? `${tally.done}/${tally.planned}` : tally.total} · {t(lang, 'sessionsThisWeek')}</span>
      </div>
      <ol className="week-strip">
        {weekStrip(p).map(d => {
          const names = d.ids.map(id => routines.find(r => r.id === id)?.name ?? '?').join(', ')
          const glyph = d.ids.length ? routines.find(r => r.id === d.ids[0])?.glyph : ''
          return (
            <li
              key={d.date} className={`strip-day ${d.status}${d.isToday ? ' today' : ''}`}
              title={`${fmtDate(d.date, lang)}: ${names || t(lang, 'rest')}`}
              aria-current={d.isToday ? 'date' : undefined}
            >
              <span className="strip-name">{fmtDate(d.date, lang, { weekday: 'short' })}</span>
              <span className="strip-mark" role="img" aria-label={t(lang, STATUS_KEY[d.status])}>
                {d.status === 'done' ? <Check size={16} /> : d.status === 'rest' ? '·' : glyph || '•'}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function WeightCard({ p, today }: { p: Profile; today: string }) {
  const { lang, unit } = p.settings
  const L = (k: Key) => t(lang, k)
  const trend = weightTrend(p)
  const [value, setValue] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const w = Number(value.replace(',', '.'))
    if (!value.trim() || !Number.isFinite(w) || w <= 0 || w > 1000) {
      toast(L('weightBad'))
      return
    }
    updateProfile(x => addWeighIn(x, w, today))
    setValue('')
    toast(L('weightAdded'))
  }
  return (
    <section className="card weight-card">
      <h2>{L('bodyWeight')}</h2>
      {trend && (
        <p className="weight-last">
          <span className="muted">{L('lastValue')}: </span><b>{fmtNum(trend.last, lang)} {unit}</b>
          {trend.delta != null && <span className="delta">{trend.delta > 0 ? '+' : ''}{fmtNum(trend.delta, lang)}</span>}
          <span className="muted"> · {fmtDate(trend.date, lang, { day: 'numeric', month: 'short' })}</span>
        </p>
      )}
      <form className="weight-form" onSubmit={submit}>
        <input className="input" inputMode="decimal" value={value} placeholder={unit} aria-label={`${L('bodyWeight')}, ${unit}`} onChange={e => setValue(e.target.value)} />
        <button type="submit" className="btn">{L('add')}</button>
      </form>
    </section>
  )
}

function Tip({ icon, text, children }: { icon: ReactNode; text: string; children?: ReactNode }) {
  const [hidden, setHidden] = useState(false)
  const { lang } = useSettings()
  if (hidden) return null
  return (
    <aside className="tip">
      {icon}
      <div className="tip-body">
        <p>{text}</p>
        {children}
      </div>
      <button type="button" className="icon-btn" aria-label={t(lang, 'dismiss')} onClick={() => setHidden(true)}><X size={16} /></button>
    </aside>
  )
}

export default function Home() {
  const p = useProfile()
  const { lang, ramadanMode, heatTips, showWeightCard, weekStart } = p.settings
  const L = (k: Key) => t(lang, k)
  useCustomExercises(p.customEx)
  const [onboarding, setOnboarding] = useState(false)
  const [programs, setPrograms] = useState<{ focus?: string } | null>(null)
  const now = new Date()
  const today = isoDate(now)
  const streak = weekStreak(p.workouts, now, weekStart)

  return (
    <>
      {ramadanMode && (
        <Tip icon={<Moon size={18} />} text={L('ramadanTip')}>
          <button type="button" className="btn small" onClick={() => setPrograms({ focus: 'ramadan-light' })}>{L('ramadanCta')}</button>
        </Tip>
      )}
      {heatTips && isHeatSeason(now) && <Tip icon={<Sun size={18} />} text={L('heatTip')} />}

      {p.active && (
        <section className="card continue-card">
          <div>
            <p className="muted">{L('continueWorkout')}</p>
            <h2>{p.active.name}</h2>
          </div>
          <a className="btn primary" href="#/workout"><Play size={18} />{L('resume')}</a>
        </section>
      )}

      {p.routines.length === 0 ? (
        <section className="card today-empty">
          <h1>{L('homeEmptyTitle')}</h1>
          <p className="muted">{L('homeEmptyText')}</p>
          <div className="row wrap center">
            <button type="button" className="btn primary" onClick={() => setOnboarding(true)}>{L('helpMePick')}</button>
            <button type="button" className="btn" onClick={() => setPrograms({})}>{L('programs')}</button>
          </div>
        </section>
      ) : (
        <TodayCard p={p} today={today} />
      )}

      <WeekStrip p={p} />

      <div className="home-grid">
        <section className="card streak-card">
          <Flame size={22} />
          <b>{streak}</b>
          <span className="muted">{L('streak')}</span>
        </section>
        {showWeightCard && <WeightCard p={p} today={today} />}
      </div>

      <div className="home-links">
        <a href={lang === 'uz' ? '/overview/' : `/overview/${lang}/`}>{L('overviewLink')}</a>
        <a href="/deck/tadqiqot.html" target="_blank" rel="noopener">{L('deckResearch')}</a>
        <a href="/deck/konsept.html" target="_blank" rel="noopener">{L('deckConcept')}</a>
      </div>

      {onboarding && <Onboarding onClose={() => setOnboarding(false)} />}
      {programs && <ProgramsSheet focus={programs.focus} onClose={() => setPrograms(null)} />}
    </>
  )
}

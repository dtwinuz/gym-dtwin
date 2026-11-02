import { useMemo, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { t, type Key } from '../../i18n'
import Sheet from '../../app/Sheet'
import LineChart from '../../app/charts/LineChart'
import { fmtDate, fmtNum } from '../../app/format'
import { matchesLabels } from '../../app/match'
import { bwPercent, nearestWeighIn, periodRange, recentExercises, strengthSeries, structuralBalance, type Lift, type Period } from '../../app/stats'
import { updateSettings } from '../../app/store'
import { exerciseById, exerciseName } from '../../catalogue'
import { bestE1rm, exerciseHistory, isoDate } from '../../core/history'
import { FORMULAS } from '../../core/onerm'
import type { OneRmFormula, Profile } from '../../core/types'
import PeriodSeg from './PeriodSeg'

const LIFT_KEY: Record<Lift, Key> = { squat: 'liftSquat', deadlift: 'liftDeadlift', bench: 'liftBench', ohp: 'liftOhp' }

function Picker({ ids, lang, onPick, onClose }: { ids: string[]; lang: Profile['settings']['lang']; onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const list = ids.filter(id => {
    const e = exerciseById(id)
    return matchesLabels([e?.n ?? '', e?.uz ?? '', e?.ru ?? '', ...(e?.a ?? [])], q)
  })
  return (
    <Sheet onClose={onClose} label={t(lang, 'pickExercise')} className="picker">
      <header className="sheet-head">
        <h2>{t(lang, 'pickExercise')}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t(lang, 'close')}><X size={20} /></button>
      </header>
      <div className="searchbox">
        <Search size={18} />
        <input className="input" type="search" value={q} placeholder={t(lang, 'search')} aria-label={t(lang, 'search')} onChange={e => setQ(e.target.value)} />
      </div>
      {list.length === 0 && <p className="empty pad">{t(lang, 'noResults')}</p>}
      <ul className="start-list strength-picks">
        {list.map(id => <li key={id}><button type="button" className="link-row" onClick={() => onPick(id)}>{exerciseName(exerciseById(id), lang)}</button></li>)}
      </ul>
    </Sheet>
  )
}

export default function Strength({ p }: { p: Profile }) {
  const { settings, workouts, bodyweight } = p
  const { lang, unit, oneRmFormula: formula } = settings
  const L = (k: Key) => t(lang, k)
  const [period, setPeriod] = useState<Period>('all')
  const [picked, setPicked] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const today = isoDate(new Date())

  const ids = useMemo(() => recentExercises(workouts), [workouts])
  const records = useMemo(() => ids
    .map(id => ({ id, best: bestE1rm(exerciseHistory(workouts, id), formula) }))
    .filter(r => r.best > 0)
    .sort((a, b) => b.best - a.best), [ids, workouts, formula])
  const exId = picked && ids.includes(picked) ? picked : ids.find(id => records.some(r => r.id === id)) ?? ids[0]
  const from = periodRange(period, today).from
  const points = useMemo(() => (exId ? strengthSeries(workouts, exId, formula, from) : []), [workouts, exId, formula, from])
  const allPoints = useMemo(() => (exId ? strengthSeries(workouts, exId, formula) : []), [workouts, exId, formula])
  const balance = useMemo(() => structuralBalance(workouts, formula), [workouts, formula])

  if (!exId) return <section className="card empty"><p>{L('empty')}</p></section>

  const name = exerciseName(exerciseById(exId), lang)
  const fmtKg = (v: number) => fmtNum(v, lang)
  const full = (t0: number) => fmtDate(isoDate(new Date(t0)), lang)
  const tick = (t0: number) => fmtDate(isoDate(new Date(t0)), lang, { day: 'numeric', month: 'short' })
  const top = allPoints.reduce<(typeof allPoints)[number] | null>((b, x) => (!b || x.e1rm > b.e1rm ? x : b), null)
  const bw = top ? nearestWeighIn(bodyweight, top.date) : null
  const pct = top && bw ? bwPercent(top.e1rm, bw.w) : null
  const prs = allPoints.filter(x => x.pr).length
  const first = points[0]
  const last = points.at(-1)

  return (
    <>
      <section className="card">
        <div className="row between wrap tight">
          <button type="button" className="btn ex-pick" data-pick-ex onClick={() => setPicking(true)}><span>{name}</span><ChevronDown size={16} /></button>
          <PeriodSeg value={period} onPick={setPeriod} lang={lang} />
        </div>
        {points.length === 0 ? <p className="empty pad">{L('noStrengthData')}</p> : (
          <LineChart
            height={230}
            label={`${name}, e1RM: ${first ? fmtKg(first.e1rm) : ''} → ${last ? fmtKg(last.e1rm) : ''} ${unit}`}
            formatY={v => `${fmtKg(v)}`} formatX={tick} formatFull={full}
            series={[
              { key: 'e1', label: 'e1RM', points: points.map(x => ({ x: x.t, y: x.e1rm, mark: x.pr })) },
              { key: 'best', label: L('bestSet'), soft: true, points: points.map(x => ({ x: x.t, y: x.best })) },
            ]}
          />
        )}
        <div className="lc-legend">
          <span className="key" />e1RM ({unit})
          <span className="key soft" />{L('bestSet')} ({unit})
          <span className="key mark" />PR
        </div>
        <ul className="list strength-facts">
          {top && <li><span>{L('bestE1rm')}</span><b>{fmtKg(top.e1rm)} {unit} · {fmtDate(top.date, lang, { day: 'numeric', month: 'short', year: 'numeric' })}</b></li>}
          <li><span>{L('prCount')}</span><b>{prs}</b></li>
          {pct != null && bw && <li><span>{L('bwPercent')}</span><b>{fmtNum(pct, lang, 0)}% <small className="muted">({fmtKg(bw.w)} {unit} · {fmtDate(bw.date, lang, { day: 'numeric', month: 'short' })})</small></b></li>}
        </ul>
        <label className="field">
          {L('oneRmFormula')}
          <select className="input" value={formula} onChange={e => updateSettings({ oneRmFormula: e.target.value as OneRmFormula })}>
            {(Object.keys(FORMULAS) as OneRmFormula[]).map(f => <option key={f} value={f}>{f[0].toUpperCase() + f.slice(1)}</option>)}
          </select>
        </label>
      </section>

      {balance && (
        <section className="card balance-card">
          <h2>{L('structuralBalance')}</h2>
          <p className="muted hint">{L('structuralHint')}</p>
          <ul className="list">
            {balance.rows.map(r => (
              <li key={r.a}>
                <span>{L(LIFT_KEY[r.a])} / {L(LIFT_KEY[r.b])}<small className="muted why-line">{L('ruleOfThumb')}: {fmtNum(r.rule, lang, 2)}</small></span>
                <b>{fmtNum(r.ratio, lang, 2)}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      {records.length > 0 && (
        <section className="card">
          <h2>{L('records')}</h2>
          <ul className="list">
            {records.slice(0, 15).map(r => (
              <li key={r.id}>
                <button type="button" className="link-row" onClick={() => setPicked(r.id)}>{exerciseName(exerciseById(r.id), lang)}</button>
                <b>{fmtNum(r.best, lang, 0)} {unit}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      {picking && <Picker ids={ids} lang={lang} onClose={() => setPicking(false)} onPick={id => { setPicked(id); setPicking(false) }} />}
    </>
  )
}

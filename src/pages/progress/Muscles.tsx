import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { t, type Key } from '../../i18n'
import { fmtNum } from '../../app/format'
import { muscleStrength, periodRange, type Period } from '../../app/stats'
import { allExercises, exerciseById, exerciseName } from '../../catalogue'
import BodyMap from '../../catalogue/BodyMap'
import { MUSCLE_NAME, label } from '../../catalogue/labels'
import { isoDate } from '../../core/history'
import { MUSCLES, loadLevels, muscleLoad, type ExerciseLookup } from '../../core/muscles'
import { fatigue, labelOf, untrained, type RecoveryLabel } from '../../core/recovery'
import type { Profile } from '../../core/types'
import PeriodSeg from './PeriodSeg'

type Mode = 'balance' | 'fatigue' | 'strength'

const lookup: ExerciseLookup = id => {
  const e = exerciseById(id)
  return e && { primary: e.p, secondary: e.s }
}

const RECOVERY_KEY: Record<RecoveryLabel, Key> = { ready: 'recReady', recovering: 'recRecovering', fatigued: 'recFatigued' }
const SUGGEST = 3
const MAX_NEGLECTED = 6

function suggestions(muscle: string, gear: string[] | null) {
  return allExercises()
    .filter(e => e.p[0] === muscle && e.c !== 'stretching' && e.c !== 'cardio' && (!gear || gear.includes(e.eq)))
    .sort((a, b) => Number(!!b.uz) - Number(!!a.uz) || Number(b.m === 'c') - Number(a.m === 'c'))
    .slice(0, SUGGEST)
}

export default function Muscles({ p }: { p: Profile }) {
  const { settings, workouts, gear } = p
  const { lang, unit, oneRmFormula, body } = settings
  const L = (k: Key) => t(lang, k)
  const [mode, setMode] = useState<Mode>('balance')
  const [period, setPeriod] = useState<Period>('3m')
  const [selected, setSelected] = useState<string | null>(null)
  const [hint, setHint] = useState(false)
  const [now] = useState(Date.now)
  const today = isoDate(new Date(now))

  const used: Period = mode === 'strength' && period === 'all' ? '3m' : period
  const from = periodRange(used, today).from

  const rows = useMemo(() => {
    if (mode === 'balance') {
      const load = muscleLoad(workouts, lookup, from ?? undefined)
      const levels = loadLevels(load)
      return Object.entries(load).sort((a, b) => b[1] - a[1]).map(([m, v]) => ({ m, level: levels[m] / 4, value: `${fmtNum(v, lang)} ${L('setsShort')}`, sub: '' }))
    }
    if (mode === 'fatigue') {
      return Object.entries(fatigue(workouts, lookup, now)).sort((a, b) => b[1] - a[1]).map(([m, f]) => ({ m, level: f, value: `${fmtNum(f * 100, lang, 0)}%`, sub: L(RECOVERY_KEY[labelOf(f)]) }))
    }
    return Object.entries(muscleStrength(workouts, lookup, oneRmFormula, from)).sort((a, b) => b[1].ratio - a[1].ratio).map(([m, s]) => ({
      m, level: s.ratio, value: `${fmtNum(s.ratio * 100, lang, 0)}%`, sub: `${fmtNum(s.now, lang)} / ${fmtNum(s.peak, lang)} ${unit}`,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, workouts, from, now, lang, unit, oneRmFormula])

  const neglected = useMemo(() => untrained(workouts, lookup, MUSCLES, 14, now).slice(0, MAX_NEGLECTED), [workouts, now])
  const levels = Object.fromEntries(rows.map(r => [r.m, r.level]))
  const summary = rows.slice(0, 5).map(r => `${label(MUSCLE_NAME, r.m, lang)} ${r.value}`).join(', ')

  if (workouts.length === 0) return <section className="card empty"><p>{L('empty')}</p></section>

  return (
    <>
      <section className="card">
        <div className="row between wrap tight">
          <div className="seg mode-seg" role="radiogroup" aria-label={L('tabMuscles')}>
            {(['balance', 'fatigue', 'strength'] as const).map(x => (
              <button type="button" key={x} role="radio" aria-checked={x === mode} className={x === mode ? 'on' : ''} data-mode={x} onClick={() => { setMode(x); setSelected(null); setHint(false) }}>
                {L(x === 'balance' ? 'modeBalance' : x === 'fatigue' ? 'modeFatigue' : 'tabStrength')}
              </button>
            ))}
          </div>
          {mode !== 'fatigue' && <PeriodSeg value={used} onPick={setPeriod} lang={lang} options={mode === 'strength' ? ['1m', '3m', '1y'] : undefined} />}
        </div>
        <p className="muted hint">
          {L(mode === 'balance' ? 'balanceHint' : mode === 'fatigue' ? 'fatigueHint' : 'strengthShort')}
          {mode === 'strength' && <button type="button" className="icon-btn info-btn" aria-label={L('strengthHint')} aria-expanded={hint} onClick={() => setHint(!hint)}><Info size={16} /></button>}
        </p>
        {mode === 'strength' && hint && <p className="tip-text" role="note">{L('strengthHint')}</p>}
        <BodyMap
          levels={levels} figure={body} selected={selected} className="muscle-map"
          onPick={m => setSelected(m === selected ? null : m)} label={`${L('muscleMap')}: ${summary || L('noData')}`}
        />
        {rows.length === 0 ? <p className="empty pad">{L('noData')}</p> : (
          <ul className="list muscle-rows">
            {rows.map(r => (
              <li key={r.m} className={r.m === selected ? 'on' : ''}>
                <button type="button" className="muscle-row" aria-pressed={r.m === selected} onClick={() => setSelected(r.m === selected ? null : r.m)}>
                  <span>{label(MUSCLE_NAME, r.m, lang)}{r.sub && <small className="muted why-line">{r.sub}</small>}</span>
                  <b>{r.value}</b>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {neglected.length > 0 && (
        <section className="card neglected">
          <h2>{L('neglected')}</h2>
          <p className="muted hint">{L('neglectedHint')}</p>
          {neglected.map(m => (
            <div key={m} className="neglected-row">
              <h3>{label(MUSCLE_NAME, m, lang)}</h3>
              <div className="neglected-ex">
                {suggestions(m, gear).map(e => <a key={e.id} className="btn small" href={`#/exercises/${encodeURIComponent(e.id)}`}>{exerciseName(e, lang)}</a>)}
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  )
}

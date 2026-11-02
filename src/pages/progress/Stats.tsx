import { useMemo, useState } from 'react'
import { t, type Key } from '../../i18n'
import Bars from '../../app/charts/Bars'
import Heatmap from '../../app/charts/Heatmap'
import { fmtDate, fmtNum, weekdayName } from '../../app/format'
import { aggregate, delta, effortDist, heatmapWeeks, periodRange, type Period } from '../../app/stats'
import { isoDate, setsDone, weekStreak } from '../../core/history'
import type { Profile } from '../../core/types'
import PeriodSeg from './PeriodSeg'

function Tile({ value, label, change, text, pct, lang }: { value: string; label: string; change?: number; text?: string; pct?: number | null; lang: Profile['settings']['lang'] }) {
  return (
    <div className="card stat tile">
      <b>{value}</b>
      <span>{label}</span>
      {change != null && (
        <small className={change > 0 ? 'delta-up' : change < 0 ? 'delta-down' : 'muted'}>
          {change > 0 ? '+' : ''}{text}{pct != null ? ` (${pct > 0 ? '+' : ''}${fmtNum(pct, lang, 0)}%)` : ''}
        </small>
      )}
    </div>
  )
}

const RPE_LABELS = ['10', '9', '8', '7', '6', '≤5']
const RIR_LABELS = ['0', '1', '2', '3', '4', '5+']

export default function Stats({ p }: { p: Profile }) {
  const { settings, workouts } = p
  const { lang, unit, weekStart, effort } = settings
  const L = (k: Key) => t(lang, k)
  const [period, setPeriod] = useState<Period>('3m')
  const [day, setDay] = useState<string | null>(null)
  const today = isoDate(new Date())
  const range = periodRange(period, today)
  const now = useMemo(() => aggregate(workouts, range.from, range.to), [workouts, range.from, range.to])
  const prev = useMemo(() => aggregate(workouts, range.prevFrom, range.prevTo), [workouts, range.prevFrom, range.prevTo])
  const compared = period !== 'all' && prev.workouts > 0
  const weeks = useMemo(() => heatmapWeeks(workouts, weekStart, today), [workouts, weekStart, today])
  const dist = useMemo(() => effortDist(workouts, range.from, range.to), [workouts, range.from, range.to])
  const streak = weekStreak(workouts, new Date(), weekStart)
  const activeDays = useMemo(() => weeks.flat().filter(d => d.sets > 0).length, [weeks])

  if (workouts.length === 0) {
    return <section className="card empty"><p>{L('empty')}</p><div className="row center"><a className="btn primary" href="#/workout">{L('start')}</a></div></section>
  }

  const num = (v: number) => fmtNum(v, lang, 0)
  const hours = Math.floor(now.minutes / 60)
  const time = hours ? `${hours} ${L('hourShort')} ${now.minutes % 60} ${L('minShort')}` : `${now.minutes} ${L('minShort')}`
  const tile = (value: string, label: Key, cur: number, was: number, fmt: (v: number) => string = num) => {
    const d = delta(cur, was)
    return <Tile value={value} label={L(label)} change={compared ? d.diff : undefined} text={fmt(d.diff)} pct={d.pct} lang={lang} />
  }
  const onDay = day ? workouts.filter(w => w.date === day) : []
  const labels = effort === 'rpe' ? RPE_LABELS : RIR_LABELS

  return (
    <>
      <div className="row between wrap">
        <PeriodSeg value={period} onPick={setPeriod} lang={lang} />
        {compared && <span className="muted">{L('vsPrevious')}</span>}
      </div>

      <div className="tiles">
        {tile(num(now.workouts), 'sessions', now.workouts, prev.workouts)}
        {tile(`${num(now.volume)} ${unit}`, 'volumeShort', now.volume, prev.volume)}
        {tile(num(now.sets), 'sets', now.sets, prev.sets)}
        {tile(time, 'duration', now.minutes, prev.minutes, v => `${num(v)} ${L('minShort')}`)}
        <Tile value={num(streak)} label={L('weekStreak')} lang={lang} />
      </div>

      <section className="card">
        <h2>{L('activity')}</h2>
        <Heatmap
          weeks={weeks} selected={day} onPick={setDay}
          label={L('activitySummary').replace('{n}', String(activeDays))}
          monthName={d => fmtDate(d, lang, { month: 'short' })}
          dayName={r => weekdayName((r + weekStart) % 7, lang, 'short')}
          dayText={d => `${fmtDate(d.date, lang)}: ${d.sets} ${L('setsShort')}`}
        />
        <div className="hm-day" aria-live="polite">
          {!day && <p className="muted">{L('tapDay')}</p>}
          {day && <h3>{fmtDate(day, lang, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>}
          {day && onDay.length === 0 && <p className="muted">{L('dayEmpty')}</p>}
          {onDay.map(w => (
            <a key={w.id} className="hm-link" href={`#/progress/history?w=${encodeURIComponent(w.id)}`}>
              <b>{w.name}</b>
              <span className="muted">{setsDone(w.entries)} {L('setsShort')} · {fmtNum(w.vol, lang, 0)} {unit}</span>
            </a>
          ))}
        </div>
      </section>

      {dist && (
        <section className="card">
          <h2>{L('effortStats')} <span className="muted">· {effort === 'rpe' ? 'RPE' : 'RIR'}</span></h2>
          <Bars
            label={`${L('effortStats')}: ${dist.map((v, i) => `${labels[i]} = ${v}`).join(', ')}`}
            items={dist.map((value, i) => ({ label: labels[i], value, title: `${labels[i]}: ${value} ${L('setsShort')}` }))}
          />
        </section>
      )}
    </>
  )
}

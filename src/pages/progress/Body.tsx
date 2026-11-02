import { useMemo, useState, type FormEvent } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { t, type Key } from '../../i18n'
import LineChart from '../../app/charts/LineChart'
import { goalFit, removeWeighIn, saveWeighIn, weeklyRate } from '../../app/body'
import { fmtDate, fmtNum } from '../../app/format'
import { parseNum } from '../../app/session'
import { updateProfile, updateSettings } from '../../app/store'
import { toast } from '../../app/toast'
import { isoDate, parseIso } from '../../core/history'
import type { ISODate, Profile, Settings, WeighIn } from '../../core/types'
import Measurements from './Measurements'
import Photos from './Photos'

const SHOWN = 6
const FIT_KEY = { match: 'fitMatch', opposite: 'fitOpposite', steady: 'fitSteady' } satisfies Record<string, Key>

export default function Body({ p }: { p: Profile }) {
  const { settings, bodyweight, targetW } = p
  const { lang, unit, weightGoal } = settings
  const L = (k: Key) => t(lang, k)
  const today = isoDate(new Date())
  const [value, setValue] = useState('')
  const [date, setDate] = useState(today)
  const [editing, setEditing] = useState<ISODate | null>(null)
  const [all, setAll] = useState(false)
  const [target, setTarget] = useState<string | null>(null)

  const sorted = useMemo(() => [...bodyweight].sort((a, b) => a.date.localeCompare(b.date)), [bodyweight])
  const rate = useMemo(() => weeklyRate(sorted), [sorted])
  const fit = rate == null ? null : goalFit(rate, weightGoal, unit)
  const newestFirst = [...sorted].reverse()
  const first = sorted[0]
  const last = sorted.at(-1)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const w = parseNum(value)
    if (!w || w > 1000) {
      toast(L('weightBad'))
      return
    }
    if (!date || date > today) {
      toast(L('dateBad'))
      return
    }
    updateProfile(x => saveWeighIn(x, w, date, editing ?? undefined))
    setValue('')
    setDate(today)
    setEditing(null)
    toast(L('weightAdded'))
  }
  const del = (b: WeighIn) => {
    updateProfile(x => removeWeighIn(x, b.date))
    toast(L('weightDeleted'), { label: L('undo'), run: () => updateProfile(x => saveWeighIn(x, b.w, b.date, undefined, b.t)) })
  }
  const startEdit = (b: WeighIn) => {
    setEditing(b.date)
    setDate(b.date)
    setValue(String(b.w))
  }
  const commitTarget = () => {
    if (target == null) return
    const v = target.trim() ? parseNum(target) : null
    if (v === undefined || (v != null && (v <= 0 || v > 1000))) toast(L('weightBad'))
    else updateProfile(x => ({ ...x, targetW: v ?? null }))
    setTarget(null)
  }

  return (
    <>
      <section className="card weight-progress">
        <h2>{L('bodyWeight')}</h2>
        {sorted.length > 0 ? (
          <LineChart
            label={`${L('bodyWeight')}: ${first ? fmtNum(first.w, lang) : ''} → ${last ? fmtNum(last.w, lang) : ''} ${unit}${targetW != null ? `, ${L('goal')} ${fmtNum(targetW, lang)} ${unit}` : ''}`}
            formatY={v => `${fmtNum(v, lang)}`} formatX={v => fmtDate(isoDate(new Date(v)), lang, { day: 'numeric', month: 'short' })} formatFull={v => fmtDate(isoDate(new Date(v)), lang)}
            target={targetW != null ? { y: targetW, label: `${L('goal')} ${fmtNum(targetW, lang)}` } : undefined}
            series={[{ key: 'w', label: unit, points: sorted.map(b => ({ x: parseIso(b.date).getTime(), y: b.w })) }]}
          />
        ) : <p className="empty pad">{L('noWeightYet')}</p>}

        {rate != null && (
          <p className="rate-line">
            <b>{rate > 0 ? '+' : ''}{fmtNum(rate, lang, 2)} {unit}</b> {L('perWeekShort')}
            {fit && <span className={fit === 'match' ? 'delta-up' : 'muted'}> · {L(FIT_KEY[fit])}</span>}
          </p>
        )}

        <div className="body-settings">
          <div className="field">
            {L('weightGoal')}
            <div className="seg mode-seg" role="radiogroup" aria-label={L('weightGoal')}>
              {(['lose', 'hold', 'gain'] as Settings['weightGoal'][]).map(g => (
                <button type="button" key={g} role="radio" aria-checked={g === weightGoal} className={g === weightGoal ? 'on' : ''} onClick={() => updateSettings({ weightGoal: g })}>
                  {L(g === 'lose' ? 'goalLose' : g === 'gain' ? 'goalGain' : 'goalHold')}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            {L('targetWeight')} ({unit})
            <input
              className="input" inputMode="decimal" data-target-weight value={target ?? (targetW == null ? '' : String(targetW))}
              onChange={e => setTarget(e.target.value)} onBlur={commitTarget} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
            />
          </label>
        </div>

        <form className="weigh-form" onSubmit={submit}>
          <label className="field">{L('date')}<input className="input" type="date" required max={today} value={date} onChange={e => setDate(e.target.value)} /></label>
          <label className="field">{unit}<input className="input" inputMode="decimal" data-weigh-value value={value} onChange={e => setValue(e.target.value)} /></label>
          <button type="submit" className="btn primary" data-weigh-add>{L(editing ? 'save' : 'add')}</button>
        </form>

        {sorted.length > 0 && (
          <ul className="list weigh-list">
            {newestFirst.slice(0, all ? undefined : SHOWN).map(b => (
              <li key={b.date}>
                <span>{fmtDate(b.date, lang)}</span>
                <span className="row-gap">
                  <b>{fmtNum(b.w, lang)} {unit}</b>
                  <button type="button" className="icon-btn" aria-label={`${L('edit')}: ${fmtDate(b.date, lang)}`} onClick={() => startEdit(b)}><Pencil size={15} /></button>
                  <button type="button" className="icon-btn" data-weigh-del aria-label={`${L('remove')}: ${fmtDate(b.date, lang)}`} onClick={() => del(b)}><Trash2 size={15} /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {sorted.length > SHOWN && <button type="button" className="btn small ghost" onClick={() => setAll(!all)}>{L(all ? 'showLess' : 'showMore')}</button>}
      </section>

      <Measurements p={p} />
      <Photos lang={lang} />
    </>
  )
}

import { useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { t, type Key } from '../../i18n'
import Sheet from '../../app/Sheet'
import LineChart from '../../app/charts/LineChart'
import { fromDisplayLength, isBuiltinMeasure, lengthUnit, measureKeys, measureSeries, removeMeasurement, saveMeasurement, toDisplayLength } from '../../app/body'
import { fmtDate, fmtNum } from '../../app/format'
import { updateProfile } from '../../app/store'
import { toast } from '../../app/toast'
import { isoDate, parseIso } from '../../core/history'
import type { Measurement, Profile } from '../../core/types'
import NumInput from '../workout/NumInput'

const NAME_KEY: Record<string, Key> = { waist: 'mWaist', chest: 'mChest', hip: 'mHip', thigh: 'mThigh', arm: 'mArm', calf: 'mCalf', neck: 'mNeck' }

function MeasureSheet({ p, entry, onClose }: { p: Profile; entry: Measurement | null; onClose: () => void }) {
  const { lang, unit } = p.settings
  const L = (k: Key) => t(lang, k)
  const today = isoDate(new Date())
  const [date, setDate] = useState(entry?.date ?? today)
  const [values, setValues] = useState<Record<string, number | undefined>>(() =>
    Object.fromEntries(Object.entries(entry?.values ?? {}).map(([k, v]) => [k, toDisplayLength(v, unit)])))
  const [customName, setCustomName] = useState('')
  const [customValue, setCustomValue] = useState<number | undefined>()
  const keys = measureKeys(p.measurements)
  const name = (k: string) => (isBuiltinMeasure(k) ? L(NAME_KEY[k]) : k)

  const submit = () => {
    if (!date || date > today) {
      toast(L('dateBad'))
      return
    }
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(values)) if (v != null && v > 0) out[k] = fromDisplayLength(v, unit)
    const custom = customName.trim().slice(0, 30)
    if (custom && customValue != null && customValue > 0) out[custom] = fromDisplayLength(customValue, unit)
    if (Object.keys(out).length === 0) {
      toast(L('measureEmpty'))
      return
    }
    onClose()
    updateProfile(x => saveMeasurement(x, date, out, entry?.date))
    toast(L('measureSaved'))
  }

  return (
    <Sheet onClose={onClose} label={L('addMeasure')} className="form measure-sheet" onSubmit={submit}>
      <header className="sheet-head">
        <h2>{L('addMeasure')}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={L('close')}><X size={20} /></button>
      </header>
      <label>{L('date')}<input className="input" type="date" required max={today} value={date} onChange={e => setDate(e.target.value)} /></label>
      <div className="form-grid measure-grid">
        {keys.map(k => (
          <label key={k}>{name(k)} ({lengthUnit(unit)})<NumInput value={values[k]} onChange={v => setValues(x => ({ ...x, [k]: v }))} label={name(k)} /></label>
        ))}
      </div>
      <div className="form-grid">
        <label>{L('customMeasure')}<input className="input" maxLength={30} value={customName} onChange={e => setCustomName(e.target.value)} /></label>
        <label>{lengthUnit(unit)}<NumInput value={customValue} onChange={setCustomValue} label={L('customMeasure')} /></label>
      </div>
      <div className="row between finish-actions">
        <button type="button" className="btn" onClick={onClose}>{L('cancel')}</button>
        <button type="submit" className="btn primary" data-measure-save>{L('save')}</button>
      </div>
    </Sheet>
  )
}

export default function Measurements({ p }: { p: Profile }) {
  const { settings, measurements } = p
  const { lang, unit } = settings
  const L = (k: Key) => t(lang, k)
  const [sheet, setSheet] = useState<Measurement | 'new' | null>(null)
  const lu = lengthUnit(unit)
  const name = (k: string) => (isBuiltinMeasure(k) ? L(NAME_KEY[k]) : k)
  const withData = measureKeys(measurements).map(k => ({ k, series: measureSeries(measurements, k) })).filter(x => x.series.length > 0)
  const dated = [...measurements].sort((a, b) => b.date.localeCompare(a.date))

  const del = (m: Measurement) => {
    updateProfile(x => removeMeasurement(x, m.date))
    toast(L('measureDeleted'), { label: L('undo'), run: () => updateProfile(x => saveMeasurement(x, m.date, m.values, undefined, m.t)) })
  }

  return (
    <section className="card measures">
      <div className="row between tight">
        <h2>{L('measurements')}</h2>
        <button type="button" className="btn small" data-measure-add onClick={() => setSheet('new')}><Plus size={16} />{L('add')}</button>
      </div>
      {withData.length === 0 && <p className="empty pad">{L('noMeasures')}</p>}
      <div className="measure-cards">
        {withData.map(({ k, series }) => {
          const last = series[series.length - 1]
          const shown = (v: number) => `${fmtNum(toDisplayLength(v, unit), lang)} ${lu}`
          return (
            <div key={k} className="measure-card" data-measure={k}>
              <div className="measure-head"><span>{name(k)}</span><b>{shown(last.v)}</b></div>
              <LineChart
                compact height={64}
                label={`${name(k)}: ${shown(series[0].v)} → ${shown(last.v)}`}
                formatY={v => shown(v)} formatX={v => fmtDate(isoDate(new Date(v)), lang)} formatFull={v => fmtDate(isoDate(new Date(v)), lang)}
                series={[{ key: k, label: name(k), points: series.map(s => ({ x: parseIso(s.date).getTime(), y: s.v })) }]}
              />
            </div>
          )
        })}
      </div>
      {dated.length > 0 && (
        <details className="measure-log">
          <summary>{L('allEntries')} ({dated.length})</summary>
          <ul className="list">
            {dated.map(m => (
              <li key={m.date}>
                <span>{fmtDate(m.date, lang)}<small className="muted why-line">{Object.entries(m.values).map(([k, v]) => `${name(k)} ${fmtNum(toDisplayLength(v, unit), lang)}`).join(' · ')}</small></span>
                <span className="row-gap">
                  <button type="button" className="icon-btn" aria-label={`${L('edit')}: ${fmtDate(m.date, lang)}`} onClick={() => setSheet(m)}><Pencil size={15} /></button>
                  <button type="button" className="icon-btn" data-measure-del aria-label={`${L('remove')}: ${fmtDate(m.date, lang)}`} onClick={() => del(m)}><Trash2 size={15} /></button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {sheet && <MeasureSheet p={p} entry={sheet === 'new' ? null : sheet} onClose={() => setSheet(null)} />}
    </section>
  )
}

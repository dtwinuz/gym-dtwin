import { useState, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { LANGS, t, type Key, type Lang } from '../i18n'
import { FORMULAS, e1rm } from '../core/onerm'
import type { OneRmFormula, Settings as S, Unit } from '../core/types'
import { ACCENTS, accentTokens } from '../app/color'
import { convertProfileUnits } from '../app/convert'
import { matchesLabels } from '../app/match'
import { updateProfile, updateSettings, useSettings } from '../app/store'
import { resolveTheme, useSystemLight } from '../app/theme'
import { toast } from '../app/toast'
import { fmtNum } from '../app/format'
import SafetyNotice from '../app/SafetyNotice'

const LANG_NAME: Record<Lang, string> = { uz: 'O\'zbekcha', ru: 'Русский', en: 'English' }

function Seg<T extends string | number>({ value, options, onPick, label }: { value: T; options: [T, string][]; onPick: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button type="button" key={String(v)} role="radio" aria-checked={v === value} className={v === value ? 'on' : ''} onClick={() => onPick(v)}>{l}</button>
      ))}
    </div>
  )
}

function Toggle({ k, label }: { k: 'sound' | 'vibrate' | 'keepAwake' | 'ramadanMode' | 'heatTips'; label: string }) {
  const s = useSettings()
  return <input type="checkbox" className="switch" checked={s[k]} onChange={e => updateSettings({ [k]: e.target.checked } as Partial<S>)} aria-label={label} />
}

interface Item { key: Key; hint?: ReactNode; control: ReactNode; wide?: boolean }

export default function Settings() {
  const s = useSettings()
  const lang = s.lang
  const L = (k: Key) => t(lang, k)
  const [q, setQ] = useState('')
  const [safety, setSafety] = useState(false)
  const mode = resolveTheme(s.theme, useSystemLight())
  const shown = accentTokens(s.accent, mode).accent

  const setUnit = (u: Unit) => {
    if (u === s.unit) return
    updateProfile(p => convertProfileUnits(p, u))
    toast(L('unitConverted'))
  }

  const sections: [Key, Item[]][] = [
    ['secLook', [
      { key: 'theme', control: <Seg label={L('theme')} value={s.theme} onPick={theme => updateSettings({ theme })} options={[['system', L('themeSystem')], ['dark', L('themeDark')], ['light', L('themeLight')]]} /> },
      {
        key: 'accent', wide: true,
        hint: shown.toLowerCase() !== s.accent.toLowerCase() ? L('accentAdjusted') : undefined,
        control: (
          <div className="swatches">
            {ACCENTS.map(c => (
              <button
                type="button" key={c} className={`swatch${c === s.accent ? ' on' : ''}`} style={{ background: accentTokens(c, mode).accent }}
                onClick={() => updateSettings({ accent: c })} aria-label={c} aria-pressed={c === s.accent}
              />
            ))}
            <label className={`swatch custom${ACCENTS.includes(s.accent as (typeof ACCENTS)[number]) ? '' : ' on'}`} title={L('accentCustom')}>
              <input type="color" value={s.accent} onChange={e => updateSettings({ accent: e.target.value })} aria-label={L('accentCustom')} />
            </label>
          </div>
        ),
      },
      { key: 'figure', control: <Seg label={L('figure')} value={s.body} onPick={body => updateSettings({ body })} options={[['male', L('male')], ['female', L('female')]]} /> },
    ]],
    ['secUnits', [
      { key: 'weightUnit', hint: L('unitHint'), control: <Seg label={L('weightUnit')} value={s.unit} onPick={setUnit} options={[['kg', 'kg'], ['lb', 'lb']]} /> },
    ]],
    ['secTraining', [
      {
        key: 'restSec',
        control: (
          <input
            className="input num" type="number" inputMode="numeric" min={0} max={900} step={15} value={s.restSec} aria-label={L('restSec')}
            onChange={e => updateSettings({ restSec: Math.max(0, Math.min(900, Math.round(Number(e.target.value) || 0))) })}
          />
        ),
      },
      { key: 'effort', control: <Seg label={L('effort')} value={s.effort} onPick={effort => updateSettings({ effort })} options={[['none', L('effortNone')], ['rir', 'RIR'], ['rpe', 'RPE']]} />, hint: s.effort === 'rir' ? L('effortRir') : s.effort === 'rpe' ? L('effortRpe') : undefined },
      { key: 'workoutView', control: <Seg label={L('workoutView')} value={s.workoutView} onPick={workoutView => updateSettings({ workoutView })} options={[['cards', L('viewCards')], ['list', L('viewList')]]} /> },
      { key: 'sound', control: <Toggle k="sound" label={L('sound')} /> },
      { key: 'vibrate', control: <Toggle k="vibrate" label={L('vibrate')} /> },
      { key: 'keepAwake', control: <Toggle k="keepAwake" label={L('keepAwake')} /> },
    ]],
    ['secCalendar', [
      { key: 'weekStart', control: <Seg<0 | 1> label={L('weekStart')} value={s.weekStart} onPick={weekStart => updateSettings({ weekStart })} options={[[1, L('monday')], [0, L('sunday')]]} /> },
    ]],
    ['secLocal', [
      { key: 'ramadanMode', hint: L('ramadanHint'), control: <Toggle k="ramadanMode" label={L('ramadanMode')} /> },
      { key: 'heatTips', hint: L('heatHint'), control: <Toggle k="heatTips" label={L('heatTips')} /> },
    ]],
    ['secCalc', [
      {
        key: 'oneRmFormula', hint: L('oneRmHint'),
        control: (
          <select className="input" value={s.oneRmFormula} onChange={e => updateSettings({ oneRmFormula: e.target.value as OneRmFormula })} aria-label={L('oneRmFormula')}>
            {(Object.keys(FORMULAS) as OneRmFormula[]).map(f => (
              <option key={f} value={f}>{f[0].toUpperCase() + f.slice(1)} · {fmtNum(e1rm(100, 5, f), lang)}</option>
            ))}
          </select>
        ),
      },
    ]],
    ['language', [
      { key: 'language', control: <Seg label={L('language')} value={lang} onPick={l => updateSettings({ lang: l })} options={LANGS.map(l => [l, LANG_NAME[l]])} /> },
    ]],
    ['secData', [
      { key: 'dataLocal', wide: true, control: <p className="muted">{L('dataSoon')}</p> },
    ]],
    ['secSafety', [
      { key: 'safetyOpen', control: <button type="button" className="btn" onClick={() => setSafety(true)}>{L('safetyTitle')}</button> },
    ]],
  ]

  const labelsOf = (k: Key, sec: Key) => [...LANGS.map(l => t(l, k)), ...LANGS.map(l => t(l, sec))]
  const visible = sections
    .map(([sec, items]) => [sec, items.filter(it => matchesLabels(labelsOf(it.key, sec), q))] as const)
    .filter(([, items]) => items.length > 0)

  return (
    <>
      <h1>{L('settings')}</h1>
      <div className="searchbox">
        <Search size={18} />
        <input className="input" type="search" placeholder={L('searchSettings')} value={q} onChange={e => setQ(e.target.value)} aria-label={L('searchSettings')} />
        {q && <button className="icon-btn" onClick={() => setQ('')} aria-label={L('clear')}><X size={16} /></button>}
      </div>
      {visible.length === 0 && <div className="card empty">{L('noSettings')}</div>}
      {visible.map(([sec, items]) => (
        <section key={sec} className="card settings-sec">
          <h2>{L(sec)}</h2>
          {items.map(it => (
            <div key={it.key} className={`setting${it.wide ? ' wide' : ''}`}>
              <div className="setting-text">
                <span>{L(it.key)}</span>
                {it.hint && <small className="muted">{it.hint}</small>}
              </div>
              <div className="setting-ctl">{it.control}</div>
            </div>
          ))}
        </section>
      ))}
      {safety && <SafetyNotice onClose={() => setSafety(false)} />}
    </>
  )
}

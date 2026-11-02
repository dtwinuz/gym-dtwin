import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Check, Play, Square, X } from 'lucide-react'
import { t } from '../../i18n'
import { unlockAudio } from '../../app/alerts'
import { fmtNum } from '../../app/format'
import { RIR_LEVELS, RPE_LEVELS, canTick, patchDrop, patchSet, patchSide, plateLine, removeDrop, startWork, stopWork, tickSet, type Side } from '../../app/session'
import { toast } from '../../app/toast'
import type { ActiveSession, Mode, Profile, SetRow, Slot } from '../../core/types'
import { updateActive } from './active'
import NumInput from './NumInput'
import { clock } from './RestDock'

const SWIPE_DELETE = 90

function WorkButton({ s, ei, si, sec, label }: { s: ActiveSession; ei: number; si: number; sec: number; label: string }) {
  const running = s.work?.ei === ei && s.work.si === si
  const endsAt = running ? s.work?.endsAt ?? 0 : 0
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!running) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [running])
  return (
    <button
      type="button" className={`work-btn${running ? ' on' : ''}`} aria-label={label}
      onClick={() => { unlockAudio(); updateActive(x => (running ? stopWork(x) : startWork(x, ei, si))) }}
    >
      {running ? <><Square size={14} />{clock((endsAt - now) / 1000)}</> : <><Play size={14} />{clock(sec)}</>}
    </button>
  )
}

function plateText(p: Profile, row: SetRow, exId: string) {
  const { lang, unit } = p.settings
  const load = plateLine(p, exId, row.w)
  if (!load) return null
  const plates = load.perSide.length ? `${load.perSide.map(x => fmtNum(x, lang, 2)).join(' + ')} · ${t(lang, 'plateSide')}` : t(lang, 'plateBarOnly')
  return load.short > 0 ? `${plates} (-${fmtNum(load.short, lang, 2)} ${unit})` : plates
}

interface Props {
  p: Profile
  s: ActiveSession
  ei: number
  si: number
  row: SetRow
  mode: Mode
  slot?: Slot
  label: string
  isNext: boolean
  onMenu: () => void
  onDelete: () => void
}

export default function SetRowView({ p, s, ei, si, row, mode, slot, label, isNext, onMenu, onDelete }: Props) {
  const { lang, unit, effort, sound } = p.settings
  const L = (k: Parameters<typeof t>[1]) => t(lang, k)
  const exId = s.entries[ei].exId
  const [pickEffort, setPickEffort] = useState(false)
  const drag = useRef<{ x: number; y: number; dx: number } | null>(null)
  const el = useRef<HTMLDivElement>(null)
  const assisted = slot?.assisted
  const bodyweight = slot?.bodyweight
  const loadLabel = assisted ? `- ${unit}` : bodyweight ? `+ ${unit}` : unit

  const patch = (v: Partial<SetRow>) => updateActive(x => patchSet(x, ei, si, v))
  const tick = (side?: Side) => {
    if (!canTick(row, mode, side)) {
      toast(L('enterReps'))
      return
    }
    if (sound) unlockAudio()
    const wasDone = row.done
    updateActive(x => tickSet(x, ei, si, p.settings, Date.now(), side))
    if (!wasDone && effort !== 'none' && !row.warmup && row.rir == null && row.rpe == null) setPickEffort(true)
  }

  const onDown = (ev: PointerEvent<HTMLDivElement>) => {
    if ((ev.target as HTMLElement).closest('input,button')) return
    drag.current = { x: ev.clientX, y: ev.clientY, dx: 0 }
  }
  const onMove = (ev: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || !el.current) return
    d.dx = Math.min(0, ev.clientX - d.x)
    if (Math.abs(ev.clientY - d.y) > Math.abs(d.dx)) {
      drag.current = null
      el.current.style.transform = ''
      return
    }
    el.current.style.transform = `translateX(${d.dx}px)`
  }
  const onUp = () => {
    const d = drag.current
    drag.current = null
    if (el.current) el.current.style.transform = ''
    if (d && d.dx < -SWIPE_DELETE) onDelete()
  }

  const ratings = effort === 'rir' ? RIR_LEVELS : RPE_LEVELS
  const rating = effort === 'rir' ? row.rir : effort === 'rpe' ? row.rpe : undefined
  const effortBtn = effort !== 'none' && !row.warmup && (
    <button
      type="button" className={`effort-btn${rating != null ? ` lvl-${ratings.indexOf(rating)}` : ''}`} aria-expanded={pickEffort}
      aria-label={effort === 'rir' ? 'RIR' : 'RPE'} onClick={() => setPickEffort(v => !v)}
    >
      {rating ?? (effort === 'rir' ? 'RIR' : 'RPE')}
    </button>
  )

  const plates = mode === 'reps' && !row.done ? plateText(p, row, exId) : null

  return (
    <div className="set-wrap">
      <div
        ref={el} className={`set${row.done ? ' done' : ''}${row.warmup ? ' warm' : ''}${row.failure ? ' fail' : ''}${isNext ? ' next' : ''}`}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      >
        <button type="button" className="set-no" aria-label={`${L('setMenu')} ${label}`} onClick={onMenu}>{label}</button>

        {row.sides ? (
          <div className="sides">
            {(['L', 'R'] as Side[]).map(side => {
              const v = row.sides![side]
              return (
                <div key={side} className={`side-row${v.done ? ' done' : ''}`}>
                  <span className="side-tag">{L(side === 'L' ? 'sideL' : 'sideR')}</span>
                  <NumInput value={v.w || undefined} placeholder={loadLabel} label={`${L(side === 'L' ? 'sideL' : 'sideR')} ${loadLabel}`} onChange={w => updateActive(x => patchSide(x, ei, si, side, { w }))} />
                  <span className="times">×</span>
                  <NumInput integer value={v.r} label={`${L(side === 'L' ? 'sideL' : 'sideR')} ${L('modeReps')}`} onChange={r => updateActive(x => patchSide(x, ei, si, side, { r }))} />
                  <button type="button" className="check" aria-pressed={v.done} aria-label={`${L('done')} ${L(side === 'L' ? 'sideL' : 'sideR')}`} onClick={() => tick(side)}><Check size={18} /></button>
                </div>
              )
            })}
          </div>
        ) : mode === 'cardio' ? (
          <>
            <NumInput value={row.min} label={L('minutes')} placeholder={L('minShort')} onChange={min => patch({ min })} />
            <NumInput value={row.speed} label={L('speed')} placeholder={L('speed')} onChange={speed => patch({ speed })} />
            <NumInput value={row.incline} label={L('incline')} placeholder={L('incline')} onChange={incline => patch({ incline })} />
            <NumInput value={row.km} label={L('distanceKm')} placeholder="km" onChange={km => patch({ km })} />
            <button type="button" className="check" aria-pressed={row.done} aria-label={L('done')} onClick={() => tick()}><Check size={18} /></button>
          </>
        ) : mode === 'time' ? (
          <>
            {(row.w ?? 0) > 0 && <NumInput value={row.w} label={unit} onChange={w => patch({ w })} />}
            <NumInput integer value={row.sec} label={L('seconds')} placeholder={L('secShort')} onChange={sec => patch({ sec })} />
            {!row.done && <WorkButton s={s} ei={ei} si={si} sec={row.sec ?? 0} label={L('workTimer')} />}
            {effortBtn}
            <button type="button" className="check" aria-pressed={row.done} aria-label={L('done')} onClick={() => tick()}><Check size={18} /></button>
          </>
        ) : (
          <>
            <NumInput value={row.w || undefined} placeholder={loadLabel} label={loadLabel} onChange={w => patch({ w })} />
            <span className="times">×</span>
            <NumInput integer value={row.r} placeholder={slot?.pyramid && row.r == null ? 'max' : undefined} label={L('modeReps')} onChange={r => patch({ r })} />
            {effortBtn}
            <button type="button" className="check" aria-pressed={row.done} aria-label={L('done')} onClick={() => tick()}><Check size={18} /></button>
          </>
        )}
      </div>

      {row.sides && effortBtn && <div className="set-extra">{effortBtn}</div>}

      {row.drops?.map((d, di) => (
        <div key={di} className={`set drop${row.done ? ' done' : ''}`}>
          <span className="drop-mark" aria-hidden="true">↓</span>
          <NumInput value={d.w} label={`${L('dropset')} ${unit}`} onChange={w => updateActive(x => patchDrop(x, ei, si, di, { w: w ?? 0 }))} />
          <span className="times">×</span>
          <NumInput integer value={d.r} label={`${L('dropset')} ${L('modeReps')}`} onChange={r => updateActive(x => patchDrop(x, ei, si, di, { r: r ?? 0 }))} />
          <button type="button" className="icon-btn" aria-label={L('remove')} onClick={() => updateActive(x => removeDrop(x, ei, si, di))}><X size={16} /></button>
        </div>
      ))}

      {pickEffort && effort !== 'none' && (
        <div className="effort-pick" role="group" aria-label={effort === 'rir' ? L('effortRir') : L('effortRpe')}>
          {ratings.map((v, i) => (
            <button
              type="button" key={v} className={`lvl-${i}${v === rating ? ' on' : ''}`} aria-pressed={v === rating}
              onClick={() => { patch(effort === 'rir' ? { rir: v === rating ? undefined : v } : { rpe: v === rating ? undefined : v }); setPickEffort(false) }}
            >{v}</button>
          ))}
        </div>
      )}

      {plates && <p className="plates muted">{plates}</p>}
    </div>
  )
}

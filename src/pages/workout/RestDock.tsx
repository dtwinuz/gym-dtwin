import { useEffect, useState } from 'react'
import { Pause, Play, SkipForward } from 'lucide-react'
import { t } from '../../i18n'
import { restLeft, restPause, restResume, restShift } from '../../app/session'
import type { RestTimer, Settings } from '../../core/types'
import { updateActive } from './active'

export const clock = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function RestDock({ rest, lang }: { rest: RestTimer; lang: Settings['lang'] }) {
  const [now, setNow] = useState(Date.now)
  const paused = rest.pausedLeft != null
  useEffect(() => {
    setNow(Date.now())
    if (paused) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [paused, rest.endsAt])

  const left = restLeft(rest, now)
  const set = (next: RestTimer | undefined) => updateActive(s => {
    const out = { ...s }
    if (next) out.rest = next
    else delete out.rest
    return out
  })
  return (
    <div className={`rest-dock${paused ? ' paused' : ''}`} role="timer" aria-label={t(lang, 'rest')}>
      <span className="rest-bar" style={{ width: `${Math.min(100, (left / Math.max(1, rest.total)) * 100)}%` }} />
      <b className="rest-time">{clock(left)}</b>
      <div className="rest-actions">
        <button type="button" className="icon-btn" aria-label={t(lang, paused ? 'resume' : 'pause')} onClick={() => set(paused ? restResume(rest, Date.now()) : restPause(rest, Date.now()))}>
          {paused ? <Play size={18} /> : <Pause size={18} />}
        </button>
        <button type="button" className="rest-step" onClick={() => set(restShift(rest, -15, Date.now()))}>-15</button>
        <button type="button" className="rest-step" onClick={() => set(restShift(rest, 15, Date.now()))}>+15</button>
        <button type="button" className="icon-btn" aria-label={t(lang, 'skip')} onClick={() => set(undefined)}><SkipForward size={18} /></button>
      </div>
    </div>
  )
}

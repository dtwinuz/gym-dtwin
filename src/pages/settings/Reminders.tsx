import { t, type Key } from '../../i18n'
import type { NotifyPrefs } from '../../core/types'
import { weekdayName } from '../../app/format'
import { updateProfile, useProfile } from '../../app/store'

const WEEK = [1, 2, 3, 4, 5, 6, 0]

const localZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tashkent'
  } catch {
    return 'Asia/Tashkent'
  }
}

const defaults = (): NotifyPrefs => ({
  enabled: false, time: '18:00', days: [1, 3, 5], quietFrom: '22:00', quietTo: '08:00', tz: localZone(), diary: false,
})

export default function Reminders() {
  const { notify, settings: { lang } } = useProfile()
  const L = (k: Key) => t(lang, k)
  const n = { ...defaults(), ...notify }
  const set = (patch: Partial<NotifyPrefs>) => updateProfile(p => ({ ...p, notify: { ...defaults(), ...p.notify, ...patch } }))
  const toggleDay = (d: number) => set({ days: n.days.includes(d) ? n.days.filter(x => x !== d) : [...n.days, d].sort() })

  return (
    <div className="data-ctl">
      <label className="reminder-switch">
        <span>{L('reminderOn')}</span>
        <input type="checkbox" className="switch" data-reminder-on checked={n.enabled} onChange={e => set({ enabled: e.target.checked })} />
      </label>
      {n.enabled && (
        <>
          <div className="reminder-grid">
            <label>{L('reminderTime')}<input className="input" type="time" value={n.time} onChange={e => set({ time: e.target.value })} /></label>
            <label>{L('reminderQuietFrom')}<input className="input" type="time" value={n.quietFrom} onChange={e => set({ quietFrom: e.target.value })} /></label>
            <label>{L('reminderQuietTo')}<input className="input" type="time" value={n.quietTo} onChange={e => set({ quietTo: e.target.value })} /></label>
          </div>
          <div className="chips" role="group" aria-label={L('reminderDays')}>
            {WEEK.map(d => (
              <button type="button" key={d} className={n.days.includes(d) ? 'on' : ''} aria-pressed={n.days.includes(d)} onClick={() => toggleDay(d)}>
                {weekdayName(d, lang, 'short')}
              </button>
            ))}
          </div>
        </>
      )}
      <label className="reminder-switch">
        <span>{L('reminderDiary')}</span>
        <input type="checkbox" className="switch" checked={n.diary} onChange={e => set({ diary: e.target.checked })} />
      </label>
    </div>
  )
}

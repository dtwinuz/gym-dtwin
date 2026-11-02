/**
 * Who gets a Telegram reminder now, and what a diary entry holds. Pure logic plus one tick
 * around a Notifier: main.js does not run it until dtwin provides the channel (docs/W8-SYNC.md).
 *
 * @typedef {{ enabled?: boolean, time?: string, days?: number[], quietFrom?: string, quietTo?: string, tz?: string, diary?: boolean }} Prefs
 * @typedef {{ userId: string, notify?: Prefs, lang?: string, workouts?: { date?: string }[], active?: { date?: string } | null, lastRemindedOn?: string | null }} ReminderUser
 * @typedef {{ userId: string, date: string, text: string }} Reminder
 * @typedef {{ send(reminder: Reminder): Promise<void> }} Notifier
 */

export const WINDOW_MIN = 15

const TEXT = {
  uz: 'Bugun mashg\'ulot kuni. Zalga vaqt topa olasizmi?',
  ru: 'Сегодня день тренировки. Найдётся время для зала?',
  en: 'Today is a training day. Can you make time for it?',
}

const WEEKDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** @param {string | undefined} text @returns {number | null} */
function minutes(text) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(text ?? '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/**
 * The clock in a time zone, or null for a name Intl does not know.
 * @param {number} now @param {string} tz
 */
export function localClock(now, tz) {
  let parts
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short',
    }).formatToParts(new Date(now))
  } catch {
    return null
  }
  const get = (/** @type {string} */ type) => parts.find(p => p.type === type)?.value ?? ''
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: WEEKDAY[/** @type {keyof typeof WEEKDAY} */ (get('weekday'))],
    minute: Number(get('hour')) * 60 + Number(get('minute')),
  }
}

/** Inside quiet hours, which may run past midnight. Equal ends mean no quiet hours. */
export function inQuietHours(/** @type {number} */ minute, /** @type {string | undefined} */ from, /** @type {string | undefined} */ to) {
  const a = minutes(from)
  const b = minutes(to)
  if (a == null || b == null || a === b) return false
  return a < b ? minute >= a && minute < b : minute >= a || minute < b
}

/**
 * Called on a schedule of WINDOW_MIN. A user is due when the reminder time falls inside
 * the current window, on a chosen day, outside quiet hours, not trained or training
 * today on any device, and not yet reminded today.
 * @param {ReminderUser[]} users @param {number} now
 * @returns {Reminder[]}
 */
export function dueReminders(users, now) {
  /** @type {Reminder[]} */
  const out = []
  for (const user of users) {
    const n = user.notify
    if (!n?.enabled || !n.tz) continue
    const at = minutes(n.time)
    const clock = localClock(now, n.tz)
    if (at == null || !clock) continue
    if (!n.days?.includes(clock.weekday)) continue
    if (clock.minute < at || clock.minute >= at + WINDOW_MIN) continue
    if (inQuietHours(clock.minute, n.quietFrom, n.quietTo)) continue
    if (user.lastRemindedOn === clock.date) continue
    if (user.active?.date === clock.date || user.workouts?.some(w => w.date === clock.date)) continue
    const lang = /** @type {keyof typeof TEXT} */ (user.lang && user.lang in TEXT ? user.lang : 'uz')
    out.push({ userId: user.userId, date: clock.date, text: TEXT[lang] })
  }
  return out
}

/**
 * Send what is due; one failure neither stops the others nor counts as reminded.
 * @param {{ users: ReminderUser[], notifier: Notifier, markSent: (userId: string, date: string) => void, now: number }} options
 */
export async function runReminders({ users, notifier, markSent, now }) {
  let sent = 0
  for (const reminder of dueReminders(users, now)) {
    try {
      await notifier.send(reminder)
      markSent(reminder.userId, reminder.date)
      sent++
    } catch {
      // tried again on the next tick while the window lasts
    }
  }
  return sent
}

/**
 * The only workout facts allowed to reach the dtwin diary, and only with consent.
 * @param {{ id: string, date: string, name: string, start: number, end: number, vol: number }} workout
 * @param {Prefs | undefined} notify
 */
export function diaryEntry(workout, notify) {
  if (!notify?.diary) return null
  return {
    id: workout.id,
    date: workout.date,
    name: workout.name,
    minutes: Math.max(0, Math.round((workout.end - workout.start) / 60_000)),
    volume: workout.vol,
  }
}

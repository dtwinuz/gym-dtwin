import { createHash } from 'node:crypto'
import { diaryEntry, dueReminders, inQuietHours, localClock } from './reminders.js'

const TIMEOUT_MS = 10_000
export const TICK_MS = 5 * 60_000
export const DIARY_DAYS = 30
const WEEKLY_AT = 20 * 60
const SENT_KEEP_MS = 40 * 86_400_000

/**
 * @typedef {{ id: string, date: string, name?: string, start: number, end: number, vol?: number, prs?: string[] }} Workout
 * @typedef {{ settings?: { lang?: string }, notify?: import('./reminders.js').Prefs & { weekly?: boolean }, workouts?: Workout[], active?: { date?: string } | null }} Doc
 * @typedef {'sent' | 'no_telegram' | 'not_linked'} NotifyResult
 * @typedef {{ id: string, date: string, name: string, minutes: number, volume: number | null }} DiaryEntry
 * @typedef {{
 *   notify(userId: string, text: string): Promise<NotifyResult>,
 *   diaryPut(userId: string, entry: DiaryEntry): Promise<void>,
 *   diaryDelete(userId: string, id: string): Promise<void>,
 * }} Bridge
 */

/**
 * dtwin's internal endpoints, reached over the docker network with the service token.
 * @param {{ baseUrl: string, serviceToken: string, fetch?: typeof fetch }} options
 * @returns {Bridge}
 */
export function dtwinBridge({ baseUrl, serviceToken, fetch: send = fetch }) {
  const call = (/** @type {string} */ method, /** @type {string} */ path, /** @type {unknown} */ body = undefined) => send(`${baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${serviceToken}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  return {
    async notify(userId, text) {
      const res = await call('POST', '/internal/notify', { userId, text })
      if (res.ok) return 'sent'
      if (res.status === 409) return 'no_telegram'
      if (res.status === 404) return 'not_linked'
      throw new Error(`notify ${res.status}`)
    },
    async diaryPut(userId, entry) {
      const res = await call('POST', '/internal/diary', { userId, ...entry })
      if (!res.ok && res.status !== 404) throw new Error(`diary ${res.status}`)
    },
    async diaryDelete(userId, id) {
      const res = await call('DELETE', `/internal/diary/${encodeURIComponent(userId)}/${encodeURIComponent(id)}`)
      if (!res.ok && res.status !== 404) throw new Error(`diary delete ${res.status}`)
    },
  }
}

const NAME = { uz: 'Mashg\'ulot', ru: 'Тренировка', en: 'Workout' }
const langOf = (/** @type {string | undefined} */ lang) => /** @type {'uz' | 'ru' | 'en'} */ (lang === 'ru' || lang === 'en' ? lang : 'uz')

/** @param {string} date @param {number} days */
const shift = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)

const hashOf = (/** @type {unknown} */ v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 32)

/**
 * What the dtwin diary should change to match the profile. Recent finished workouts are
 * sent when consent is on; withdrawing consent or deleting a workout removes its entry.
 * @param {Doc} doc @param {Map<string, string>} sent workout id -> hash already in dtwin
 * @param {string} today
 * @returns {{ upserts: { entry: DiaryEntry, hash: string }[], deletes: string[] }}
 */
export function diaryChanges(doc, sent, today) {
  const consent = !!doc.notify?.diary
  const workouts = Array.isArray(doc.workouts) ? doc.workouts : []
  const ids = new Set(workouts.map(w => w.id))
  const deletes = [...sent.keys()].filter(id => !consent || !ids.has(id))
  /** @type {{ entry: DiaryEntry, hash: string }[]} */
  const upserts = []
  if (consent) {
    const from = shift(today, -DIARY_DAYS)
    const name = NAME[langOf(doc.settings?.lang)]
    for (const w of workouts) {
      if (typeof w?.id !== 'string' || !w.id || w.id.length > 100) continue
      if (typeof w.date !== 'string' || w.date < from || w.date > today) continue
      if (!Number.isFinite(w.start) || !Number.isFinite(w.end) || w.end < w.start) continue
      const base = diaryEntry({ id: w.id, date: w.date, name: (w.name || name).slice(0, 200), start: w.start, end: w.end, vol: Number.isFinite(w.vol) ? Number(w.vol) : 0 }, doc.notify)
      if (!base) continue
      const entry = { ...base, volume: base.volume > 0 ? Math.round(base.volume) : null }
      const hash = hashOf(entry)
      if (sent.get(w.id) !== hash) upserts.push({ entry, hash })
    }
  }
  return { upserts, deletes }
}

const WEEKLY = {
  uz: (/** @type {number} */ n, /** @type {number} */ min, /** @type {number} */ prs) => n
    ? `Hafta yakuni: ${n} ta mashg'ulot, ${min} daqiqa${prs ? `, ${prs} ta rekord` : ''}. Yaxshi ish!`
    : 'Bu hafta mashg\'ulot yozilmadi. Keyingi haftani bitta qisqa mashg\'ulotdan boshlaymizmi?',
  ru: (/** @type {number} */ n, /** @type {number} */ min, /** @type {number} */ prs) => n
    ? `Итоги недели: тренировок ${n}, ${min} мин${prs ? `, рекордов ${prs}` : ''}. Отличная работа!`
    : 'На этой неделе тренировок не было. Начнём следующую с одной короткой?',
  en: (/** @type {number} */ n, /** @type {number} */ min, /** @type {number} */ prs) => n
    ? `Week in review: ${n} workouts, ${min} min${prs ? `, ${prs} records` : ''}. Nice work!`
    : 'No workouts logged this week. Start next week with one short session?',
}

/**
 * Sunday evening summary of the last seven local days, for users with reminders on.
 * @param {{ userId: string, doc: Doc }[]} users @param {number} now
 * @returns {{ userId: string, key: string, text: string }[]}
 */
export function dueWeekly(users, now) {
  const out = []
  for (const { userId, doc } of users) {
    const n = doc.notify
    if (!n?.enabled || n.weekly === false || !n.tz) continue
    const clock = localClock(now, n.tz)
    if (!clock || clock.weekday !== 0) continue
    if (clock.minute < WEEKLY_AT || clock.minute >= WEEKLY_AT + 15) continue
    if (inQuietHours(clock.minute, n.quietFrom, n.quietTo)) continue
    const from = shift(clock.date, -6)
    const week = (Array.isArray(doc.workouts) ? doc.workouts : []).filter(w => typeof w?.date === 'string' && w.date >= from && w.date <= clock.date)
    const minutes = week.reduce((s, w) => s + (Number.isFinite(w.end - w.start) && w.end > w.start ? Math.round((w.end - w.start) / 60_000) : 0), 0)
    const prs = week.reduce((s, w) => s + (Array.isArray(w.prs) ? w.prs.length : 0), 0)
    out.push({ userId, key: clock.date, text: WEEKLY[langOf(doc.settings?.lang)](week.length, minutes, prs) })
  }
  return out
}

/**
 * One pass: reminders, weekly reports and diary changes. A failure for one user is logged
 * and retried on the next pass; nothing here throws.
 * @param {{ store: import('./store.js').Store, bridge: Bridge, now?: number, log: import('./app.js').Log }} options
 */
export async function tick({ store, bridge, now = Date.now(), log }) {
  const rows = store.all()
  /** @type {{ userId: string, doc: Doc, rev: number, seenRev: number | null }[]} */
  const users = []
  for (const r of rows) {
    try {
      users.push({ userId: r.userId, doc: JSON.parse(r.doc), rev: r.rev, seenRev: r.seenRev })
    } catch {
      log({ level: 'warn', msg: 'bridge bad doc' })
    }
  }
  const stats = { reminders: 0, weekly: 0, diary: 0, errors: 0 }

  const reminders = dueReminders(users.map(u => ({
    userId: u.userId, notify: u.doc.notify, lang: u.doc.settings?.lang, workouts: u.doc.workouts, active: u.doc.active,
  })), now)
  /** @type {[string, { userId: string, key: string, text: string }[]][]} */
  const batches = [['remind', reminders.map(r => ({ userId: r.userId, key: r.date, text: r.text }))], ['weekly', dueWeekly(users, now)]]
  for (const [kind, list] of batches) {
    for (const m of list) {
      if (store.sent.has(m.userId, kind, m.key)) continue
      try {
        const result = await bridge.notify(m.userId, m.text)
        store.sent.add(m.userId, kind, m.key)
        if (result === 'sent') stats[kind === 'remind' ? 'reminders' : 'weekly']++
      } catch (e) {
        stats.errors++
        log({ level: 'warn', msg: 'notify failed', err: e instanceof Error ? e.message : 'unknown' })
      }
    }
  }

  for (const u of users) {
    if (u.seenRev === u.rev) continue
    const today = localClock(now, u.doc.notify?.tz || 'Asia/Tashkent')?.date ?? new Date(now).toISOString().slice(0, 10)
    const { upserts, deletes } = diaryChanges(u.doc, store.diary.sent(u.userId), today)
    let ok = true
    for (const id of deletes) {
      try {
        await bridge.diaryDelete(u.userId, id)
        store.diary.remove(u.userId, id)
        stats.diary++
      } catch (e) {
        ok = false
        log({ level: 'warn', msg: 'diary delete failed', err: e instanceof Error ? e.message : 'unknown' })
      }
    }
    for (const { entry, hash } of upserts) {
      try {
        await bridge.diaryPut(u.userId, entry)
        store.diary.put(u.userId, entry.id, hash)
        stats.diary++
      } catch (e) {
        ok = false
        log({ level: 'warn', msg: 'diary put failed', err: e instanceof Error ? e.message : 'unknown' })
      }
    }
    if (ok) store.markSeen(u.userId, u.rev)
    else stats.errors++
  }

  store.sent.prune(now - SENT_KEEP_MS)
  return stats
}

import { DatabaseSync } from 'node:sqlite'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  rev INTEGER NOT NULL,
  doc TEXT NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS sent (
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (user_id, kind, key)
) STRICT;
CREATE TABLE IF NOT EXISTS diary (
  user_id TEXT NOT NULL,
  workout_id TEXT NOT NULL,
  hash TEXT NOT NULL,
  PRIMARY KEY (user_id, workout_id)
) STRICT;
CREATE TABLE IF NOT EXISTS bridge_seen (
  user_id TEXT PRIMARY KEY,
  rev INTEGER NOT NULL
) STRICT;
`

/**
 * @typedef {{ rev: number, doc: string, updatedAt: number }} Row
 * @typedef {{ ok: true, rev: number, updatedAt: number } | { ok: false, current: Row | null }} PutResult
 */

/**
 * One row per user. A new row takes the clock as its first revision, so a device still
 * holding a revision from before a deletion can never match it by accident.
 * @param {string} path
 * @param {() => number} [now]
 */
export function openStore(path, now = Date.now) {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;')
  db.exec(SCHEMA)
  const selectRow = db.prepare('SELECT rev, doc, updated_at AS updatedAt FROM profiles WHERE user_id = ?')
  const insertRow = db.prepare('INSERT INTO profiles (user_id, rev, doc, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (user_id) DO NOTHING')
  const updateRow = db.prepare('UPDATE profiles SET rev = rev + 1, doc = ?, updated_at = ? WHERE user_id = ? AND rev = ? RETURNING rev')
  const deleteRow = db.prepare('DELETE FROM profiles WHERE user_id = ?')
  const ping = db.prepare('SELECT 1 AS ok')
  const allRows = db.prepare('SELECT p.user_id AS userId, p.doc, p.rev, s.rev AS seenRev FROM profiles p LEFT JOIN bridge_seen s ON s.user_id = p.user_id')
  const sentGet = db.prepare('SELECT key FROM sent WHERE user_id = ? AND kind = ? AND key = ?')
  const sentPut = db.prepare('INSERT INTO sent (user_id, kind, key, at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING')
  const sentPrune = db.prepare('DELETE FROM sent WHERE at < ?')
  const diaryAll = db.prepare('SELECT workout_id AS id, hash FROM diary WHERE user_id = ?')
  const diaryPut = db.prepare('INSERT INTO diary (user_id, workout_id, hash) VALUES (?, ?, ?) ON CONFLICT (user_id, workout_id) DO UPDATE SET hash = excluded.hash')
  const diaryDel = db.prepare('DELETE FROM diary WHERE user_id = ? AND workout_id = ?')
  const seenPut = db.prepare('INSERT INTO bridge_seen (user_id, rev) VALUES (?, ?) ON CONFLICT (user_id) DO UPDATE SET rev = excluded.rev')
  const forgetUser = ['sent', 'diary', 'bridge_seen'].map(table => db.prepare(`DELETE FROM ${table} WHERE user_id = ?`))

  /** @param {string} userId @returns {Row | null} */
  const get = userId => /** @type {Row | undefined} */ (selectRow.get(userId)) ?? null

  return {
    get,

    /**
     * Compare and swap on the revision: 0 creates, anything else must match the row.
     * @param {string} userId @param {number} baseRev @param {string} doc
     * @returns {PutResult}
     */
    put(userId, baseRev, doc) {
      const at = now()
      if (baseRev === 0) {
        if (insertRow.run(userId, at, doc, at).changes === 1) return { ok: true, rev: at, updatedAt: at }
      } else {
        const row = /** @type {{ rev: number } | undefined} */ (updateRow.get(doc, at, userId, baseRev))
        if (row) return { ok: true, rev: row.rev, updatedAt: at }
      }
      return { ok: false, current: get(userId) }
    },

    /** @param {string} userId */
    remove(userId) {
      deleteRow.run(userId)
    },

    /** Removes the profile and everything the bridge remembers about the user. @param {string} userId */
    forget(userId) {
      deleteRow.run(userId)
      for (const q of forgetUser) q.run(userId)
    },

    /** @returns {{ userId: string, doc: string, rev: number, seenRev: number | null }[]} */
    all: () => /** @type {any} */ (allRows.all()),
    /** @param {string} userId @param {number} rev */
    markSeen: (userId, rev) => void seenPut.run(userId, rev),
    sent: {
      /** @param {string} userId @param {string} kind @param {string} key */
      has: (userId, kind, key) => sentGet.get(userId, kind, key) != null,
      /** @param {string} userId @param {string} kind @param {string} key */
      add: (userId, kind, key) => void sentPut.run(userId, kind, key, now()),
      /** @param {number} before */
      prune: before => void sentPrune.run(before),
    },
    diary: {
      /** @param {string} userId @returns {Map<string, string>} */
      sent: userId => new Map(/** @type {{ id: string, hash: string }[]} */ (diaryAll.all(userId)).map(r => [r.id, r.hash])),
      /** @param {string} userId @param {string} id @param {string} hash */
      put: (userId, id, hash) => void diaryPut.run(userId, id, hash),
      /** @param {string} userId @param {string} id */
      remove: (userId, id) => void diaryDel.run(userId, id),
    },

    healthy: () => ping.get() != null,
    close: () => db.close(),
  }
}

/** @typedef {ReturnType<typeof openStore>} Store */

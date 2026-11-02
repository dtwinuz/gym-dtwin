import { DatabaseSync } from 'node:sqlite'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  rev INTEGER NOT NULL,
  doc TEXT NOT NULL,
  updated_at INTEGER NOT NULL
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

    healthy: () => ping.get() != null,
    close: () => db.close(),
  }
}

/** @typedef {ReturnType<typeof openStore>} Store */

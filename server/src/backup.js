import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Consistent single-file copy of a live WAL database. Copying the .sqlite file
 * with cp would miss pages still in the -wal file.
 * @param {string} src @param {string} dest
 */
export function backupDatabase(src, dest) {
  if (existsSync(dest)) throw new Error(`exists: ${dest}`)
  mkdirSync(dirname(dest), { recursive: true })
  const tmp = `${dest}.part`
  rmSync(tmp, { force: true })
  const db = new DatabaseSync(src, { readOnly: true })
  try {
    db.prepare('VACUUM INTO ?').run(tmp)
  } finally {
    db.close()
  }
  renameSync(tmp, dest)
  return dest
}

/**
 * Opens a backup the way a restore would and checks it is usable.
 * @param {string} path
 * @returns {{ profiles: number, revSum: number }}
 */
export function verifyBackup(path) {
  const db = new DatabaseSync(path, { readOnly: true })
  try {
    const check = /** @type {{ integrity_check: string }} */ (db.prepare('PRAGMA integrity_check').get())
    if (check.integrity_check !== 'ok') throw new Error(`integrity_check: ${check.integrity_check}`)
    const rows = /** @type {{ doc: string, rev: number }[]} */ (db.prepare('SELECT doc, rev FROM profiles').all())
    let revSum = 0
    for (const r of rows) {
      JSON.parse(r.doc)
      revSum += r.rev
    }
    return { profiles: rows.length, revSum }
  } finally {
    db.close()
  }
}

/** @param {string} dir @param {number} keep */
export function prune(dir, keep) {
  const files = readdirSync(dir)
    .filter(f => /^gym-\d{8}T\d{6}Z\.sqlite$/.test(f))
    .sort()
  const old = files.slice(0, Math.max(0, files.length - keep))
  for (const f of old) rmSync(join(dir, f))
  return old
}

/** @param {Date} d */
export const backupName = d => `gym-${d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}.sqlite`

function main() {
  const src = process.env.DB_PATH || '/data/gym.sqlite'
  const dir = process.argv[2] || '/backups'
  const keep = Number(process.env.BACKUP_KEEP || 14)
  const dest = backupDatabase(src, join(dir, backupName(new Date())))
  const restored = verifyBackup(dest)
  const removed = prune(dir, keep)
  console.log(JSON.stringify({ msg: 'backup ok', file: dest, bytes: statSync(dest).size, profiles: restored.profiles, pruned: removed.length }))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (e) {
    console.error(JSON.stringify({ msg: 'backup failed', error: e instanceof Error ? e.message : String(e) }))
    process.exit(1)
  }
}

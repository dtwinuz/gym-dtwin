import { afterEach, describe, expect, it } from 'vitest'
import { copyFileSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { backupDatabase, backupName, prune, verifyBackup } from '../src/backup.js'
import { openStore } from '../src/store.js'

const dirs = []
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'gym-backup-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('backup', () => {
  it('copies rows still in the WAL and restores them', () => {
    const d = tmp()
    const live = openStore(join(d, 'gym.sqlite'))
    live.put('a', 0, JSON.stringify({ workouts: [1] }))
    const first = live.put('b', 0, JSON.stringify({ workouts: [] }))
    if (!first.ok) throw new Error('setup')
    live.put('b', first.rev, JSON.stringify({ workouts: [2, 3] }))

    const file = backupDatabase(join(d, 'gym.sqlite'), join(d, 'out', 'b.sqlite'))
    expect(verifyBackup(file).profiles).toBe(2)

    live.put('c', 0, '{}')
    live.close()

    const restoredPath = join(d, 'restored.sqlite')
    copyFileSync(file, restoredPath)
    const restored = openStore(restoredPath)
    expect(JSON.parse(restored.get('b')?.doc ?? 'null')).toEqual({ workouts: [2, 3] })
    expect(restored.get('c')).toBeNull()
    const again = restored.put('b', /** @type {number} */ (restored.get('b')?.rev), '{"workouts":[]}')
    expect(again.ok).toBe(true)
    restored.close()
  })

  it('refuses to overwrite and rejects a damaged file', () => {
    const d = tmp()
    openStore(join(d, 'gym.sqlite')).close()
    const file = backupDatabase(join(d, 'gym.sqlite'), join(d, 'x.sqlite'))
    expect(() => backupDatabase(join(d, 'gym.sqlite'), file)).toThrow(/exists/)
    writeFileSync(join(d, 'bad.sqlite'), 'not a database')
    expect(() => verifyBackup(join(d, 'bad.sqlite'))).toThrow()
  })

  it('names files by UTC time and keeps the newest', () => {
    expect(backupName(new Date(Date.UTC(2026, 10, 2, 3, 4, 5, 678)))).toBe('gym-20261102T030405Z.sqlite')
    const d = tmp()
    for (const day of [1, 2, 3, 4]) writeFileSync(join(d, `gym-2026110${day}T000000Z.sqlite`), '')
    writeFileSync(join(d, 'other.txt'), '')
    expect(prune(d, 2)).toEqual(['gym-20261101T000000Z.sqlite', 'gym-20261102T000000Z.sqlite'])
    expect(readdirSync(d).sort()).toEqual(['gym-20261103T000000Z.sqlite', 'gym-20261104T000000Z.sqlite', 'other.txt'])
  })
})

import { useRef, useState } from 'react'
import { t, type Key } from '../../i18n'
import { backupSummary, buildBackup, clearPreRestore, parseBackup, readPreRestore, stashPreRestore, type BackupError } from '../../app/data/backup'
import { download } from '../../app/data/export'
import { fmtDate } from '../../app/format'
import Sheet from '../../app/Sheet'
import { browserStorage, commitProfile, getProfile, useSettings } from '../../app/store'
import { toast } from '../../app/toast'
import { isoDate } from '../../core/history'
import type { Profile } from '../../core/types'

export const MAX_FILE = 50 * 1024 * 1024
const UNDO_MS = 20000

const ERRORS: Record<BackupError, Key> = { json: 'dataErrJson', kind: 'dataErrKind', version: 'dataErrVersion', shape: 'dataErrShape' }

export default function Backup() {
  const { lang } = useSettings()
  const L = (k: Key) => t(lang, k)
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<Key | null>(null)
  const [pending, setPending] = useState<Profile | null>(null)
  const [hasCopy, setHasCopy] = useState(() => readPreRestore(browserStorage()) != null)

  const save = () => {
    const text = JSON.stringify(buildBackup(getProfile()), null, 1)
    download(`gym-dtwin-backup-${isoDate(new Date())}.json`, text, 'application/json')
  }

  const pick = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (file.size > MAX_FILE) return setError('dataErrSize')
    const parsed = parseBackup(await file.text())
    if (parsed.ok) setPending(parsed.profile)
    else setError(ERRORS[parsed.error])
  }

  const revert = () => {
    const kv = browserStorage()
    const copy = readPreRestore(kv)
    if (!copy || !commitProfile(copy)) return setError('dataErrStorage')
    clearPreRestore(kv)
    setHasCopy(false)
    toast(L('dataRestoreReverted'))
  }

  const restore = () => {
    if (!pending) return
    const kv = browserStorage()
    if (!stashPreRestore(kv, getProfile()) || !commitProfile(pending)) {
      clearPreRestore(kv)
      setPending(null)
      setHasCopy(false)
      return setError('dataErrStorage')
    }
    setPending(null)
    setHasCopy(true)
    toast(t(pending.settings.lang, 'dataRestored'), { label: t(pending.settings.lang, 'undo'), run: revert }, UNDO_MS)
  }

  const sum = pending && backupSummary(pending)

  return (
    <div className="data-ctl">
      <div className="row wrap">
        <button type="button" className="btn" onClick={save}>{L('dataBackupSave')}</button>
        <button type="button" className="btn" onClick={() => input.current?.click()}>{L('dataRestorePick')}</button>
        <input
          ref={input} data-restore-input type="file" accept=".json,application/json" hidden aria-label={L('dataRestorePick')}
          onChange={e => { void pick(e.target.files?.[0]); e.target.value = '' }}
        />
      </div>
      {hasCopy && <button type="button" className="btn small ghost" data-restore-back onClick={revert}>{L('dataRestoreBack')}</button>}
      {error && <p className="data-err" role="alert">{L(error)}</p>}
      {pending && sum && (
        <Sheet onClose={() => setPending(null)} label={L('dataRestoreTitle')} className="confirm">
          <h2>{L('dataRestoreTitle')}</h2>
          <ul className="list">
            <li><span>{L('dataStatWorkouts')}</span><b>{sum.workouts}</b></li>
            <li><span>{L('dataStatRoutines')}</span><b>{sum.routines}</b></li>
            <li><span>{L('dataStatWeighIns')}</span><b>{sum.weighIns}</b></li>
            {sum.from && sum.to && <li><span>{L('dataStatPeriod')}</span><b>{fmtDate(sum.from, lang)} – {fmtDate(sum.to, lang)}</b></li>}
          </ul>
          <p className="muted">{L('dataRestoreWarn')}</p>
          <p className="muted">{L('dataNoPhotos')}</p>
          <div className="row">
            <button type="button" className="btn danger" data-restore-go onClick={restore}>{L('dataRestoreGo')}</button>
            <button type="button" className="btn" onClick={() => setPending(null)}>{L('cancel')}</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

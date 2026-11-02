import { useState } from 'react'
import { t, type Key } from '../../i18n'
import { buildBackup } from '../../app/data/backup'
import { download } from '../../app/data/export'
import { LOCALE } from '../../app/format'
import Sheet from '../../app/Sheet'
import { getProfile, useSettings } from '../../app/store'
import { auth, engine, signOut, useSyncState } from '../../app/syncBoot'
import type { SyncStatus } from '../../app/syncEngine'
import { toast } from '../../app/toast'
import { isoDate } from '../../core/history'

const STATUS: Record<SyncStatus, Key | null> = {
  guest: null,
  idle: 'syncIdle',
  syncing: 'syncBusy',
  offline: 'syncOffline',
  error: 'syncError',
  auth: 'syncAuth',
  tooLarge: 'syncTooLarge',
  paused: 'syncPaused',
  mismatch: 'syncMismatch',
}

export default function Account() {
  const { lang } = useSettings()
  const L = (k: Key) => t(lang, k)
  const { status, dirty, lastSyncAt } = useSyncState()
  const [signed, setSigned] = useState(() => auth.signedIn())
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<Key | null>(() => (location.hash.includes('login=') ? 'loginFailed' : null))

  const leave = async () => {
    await signOut()
    setSigned(false)
    toast(L('accountSignedOut'))
  }

  const saveCopy = () => {
    download(`gym-dtwin-backup-${isoDate(new Date())}.json`, JSON.stringify(buildBackup(getProfile()), null, 1), 'application/json')
  }

  const wipe = async () => {
    setConfirm(false)
    if (await engine.deleteServerData()) {
      setError(null)
      toast(L('syncDeleted'))
    } else {
      setError('syncDeleteFailed')
    }
  }

  const signIn = <button type="button" className="btn primary" data-sign-in onClick={() => void auth.beginLogin()}>{L('accountSignIn')}</button>
  const note = STATUS[status]

  if (!signed) {
    return (
      <div className="data-ctl">
        <p className="muted sync-facts">{L('accountGuest')} {L('accountPhotos')}</p>
        <div className="row wrap">{signIn}</div>
        {error && <p className="data-err" role="alert">{L(error)}</p>}
      </div>
    )
  }

  return (
    <div className="data-ctl">
      {note && <p className="sync-facts" data-sync-status={status}>{L(note)}</p>}
      <p className="muted sync-facts">
        {L('syncLast')}: {lastSyncAt ? new Date(lastSyncAt).toLocaleString(LOCALE[lang]) : L('syncNever')}
        {dirty && ` · ${L('syncDirty')}`}
      </p>
      <p className="muted sync-facts">{L('accountPhotos')}</p>
      <div className="row wrap">
        {status === 'auth' && signIn}
        {status === 'paused' && <button type="button" className="btn" data-sync-resume onClick={() => void engine.resume()}>{L('syncResume')}</button>}
        {status === 'mismatch' && <button type="button" className="btn" data-sync-merge onClick={() => void engine.acceptAccount()}>{L('syncMerge')}</button>}
        {status !== 'paused' && status !== 'mismatch' && <button type="button" className="btn" data-sync-now onClick={() => void engine.syncNow()}>{L('syncNow')}</button>}
        <button type="button" className="btn" data-sign-out onClick={() => void leave()}>{L('accountSignOut')}</button>
        <button type="button" className="btn danger" data-sync-delete onClick={() => setConfirm(true)}>{L('syncDelete')}</button>
      </div>
      {error && <p className="data-err" role="alert">{L(error)}</p>}
      {confirm && (
        <Sheet onClose={() => setConfirm(false)} label={L('syncDelete')} className="confirm">
          <h2>{L('syncDelete')}</h2>
          <p className="muted">{L('syncDeleteWarn')}</p>
          <div className="row wrap">
            <button type="button" className="btn" data-sync-export onClick={saveCopy}>{L('dataBackupSave')}</button>
            <button type="button" className="btn danger" data-sync-delete-go onClick={() => void wipe()}>{L('syncDeleteGo')}</button>
            <button type="button" className="btn" onClick={() => setConfirm(false)}>{L('cancel')}</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

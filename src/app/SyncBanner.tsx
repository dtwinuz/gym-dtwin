import { t } from '../i18n'
import { useSettings } from './store'
import { useSyncState } from './syncBoot'

export default function SyncBanner() {
  const { lang } = useSettings()
  const { status } = useSyncState()
  if (status !== 'offline') return null
  return <div className="sync-banner" role="status">{t(lang, 'syncOffline')}</div>
}

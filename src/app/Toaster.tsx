import { X } from 'lucide-react'
import { t } from '../i18n'
import { useSettings } from './store'
import { dismissToast, useToasts } from './toast'

export default function Toaster() {
  const toasts = useToasts()
  const { lang } = useSettings()
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map(x => (
        <div key={x.id} className="toast">
          <span>{x.text}</span>
          {x.action && (
            <button className="toast-act" onClick={() => { x.action!.run(); dismissToast(x.id) }}>{x.action.label}</button>
          )}
          <button className="icon-btn" onClick={() => dismissToast(x.id)} aria-label={t(lang, 'dismiss')}><X size={16} /></button>
        </div>
      ))}
    </div>
  )
}

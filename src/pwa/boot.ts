import { registerSW } from 'virtual:pwa-register'
import { t } from '../i18n'
import { getProfile, subscribeProfile } from '../app/store'
import { toast } from '../app/toast'
import { createUpdatePrompt } from './prompt'

const CHECK_MS = 60 * 60 * 1000

export function startPwa() {
  const prompt = createUpdatePrompt({
    busy: () => getProfile().active != null,
    subscribe: subscribeProfile,
    show: () => {
      const { lang } = getProfile().settings
      toast(t(lang, 'updateReady'), { label: t(lang, 'updateReload'), run: () => { void update(true) } }, 0)
    },
  })
  const update = registerSW({
    immediate: true,
    onNeedRefresh: () => prompt.ready(),
    onRegisteredSW: (_url, reg) => {
      if (reg) setInterval(() => { if (navigator.onLine) void reg.update() }, CHECK_MS)
    },
  })
}

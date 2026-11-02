export interface PromptDeps {
  busy: () => boolean
  subscribe: (cb: () => void) => () => void
  show: () => void
}

export function createUpdatePrompt(d: PromptDeps) {
  let pending = false
  let shown = false
  let unsub: (() => void) | null = null
  const tryShow = () => {
    if (!pending || shown || d.busy()) return
    shown = true
    unsub?.()
    unsub = null
    d.show()
  }
  return {
    ready() {
      pending = true
      tryShow()
      if (!shown && !unsub) unsub = d.subscribe(tryShow)
    },
    get shown() {
      return shown
    },
  }
}

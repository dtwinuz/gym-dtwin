import { useSyncExternalStore } from 'react'

export interface Toast {
  id: number
  text: string
  action?: { label: string; run: () => void }
}

let toasts: Toast[] = []
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

export function dismissToast(id: number) {
  toasts = toasts.filter(t => t.id !== id)
  emit()
}

export function toast(text: string, action?: Toast['action'], ms = 6000) {
  const t: Toast = { id: ++seq, text, action }
  toasts = [...toasts.slice(-2), t]
  emit()
  if (ms > 0) setTimeout(() => dismissToast(t.id), ms)
  return t.id
}

export const useToasts = () =>
  useSyncExternalStore(
    cb => {
      listeners.add(cb)
      return () => { listeners.delete(cb) }
    },
    () => toasts,
    () => toasts,
  )

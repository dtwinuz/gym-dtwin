import { useEffect, useLayoutEffect, useRef, type FormEvent, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface Entry {
  id: number
  close: () => void
  node: () => HTMLElement | null
  popped: boolean
}

const stack: Entry[] = []
let seq = 0
let ignorePops = 0
let pendingBack = 0
let listening = false

const top = () => stack[stack.length - 1]

function onPop() {
  if (ignorePops > 0) {
    ignorePops--
    return
  }
  const e = top()
  if (e) {
    e.popped = true
    e.close()
  }
}

function onKey(ev: KeyboardEvent) {
  const e = top()
  if (!e) return
  if (ev.key === 'Escape') {
    ev.preventDefault()
    e.close()
    return
  }
  if (ev.key !== 'Tab') return
  const el = e.node()
  if (!el) return
  const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(x => !x.hasAttribute('disabled') && x.offsetParent !== null)
  if (items.length === 0) {
    ev.preventDefault()
    el.focus()
    return
  }
  const first = items[0]
  const last = items[items.length - 1]
  const cur = document.activeElement
  if (ev.shiftKey && (cur === first || !el.contains(cur))) {
    ev.preventDefault()
    last.focus()
  } else if (!ev.shiftKey && (cur === last || !el.contains(cur))) {
    ev.preventDefault()
    first.focus()
  }
}

const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])'

function flushBack() {
  const n = pendingBack
  pendingBack = 0
  if (n <= 0) return
  ignorePops++
  history.go(-n)
}

interface Props {
  onClose: () => void
  label: string
  children: ReactNode
  className?: string
  /** URL for the history entry the sheet pushes (defaults to the current one). */
  url?: string
  onSubmit?: () => void
}

export default function Sheet({ onClose, label, children, className = '', url, onSubmit }: Props) {
  const ref = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  useLayoutEffect(() => { closeRef.current = onClose })
  const drag = useRef<{ y: number; dy: number } | null>(null)
  const restoreRef = useRef(typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null))

  useEffect(() => {
    const entry: Entry = { id: ++seq, close: () => closeRef.current(), node: () => ref.current, popped: false }
    const restore = restoreRef.current
    if (!listening) {
      window.addEventListener('popstate', onPop)
      window.addEventListener('keydown', onKey)
      listening = true
    }
    stack.push(entry)
    history.pushState({ ...(history.state ?? {}), sheet: entry.id }, '', url ?? location.href)
    document.body.classList.add('no-scroll')
    const el = ref.current
    const auto = el?.querySelector<HTMLElement>('[autofocus]')
    ;(auto ?? el)?.focus({ preventScroll: true })
    return () => {
      const i = stack.indexOf(entry)
      if (i >= 0) stack.splice(i, 1)
      if (stack.length === 0) document.body.classList.remove('no-scroll')
      if (!entry.popped) {
        pendingBack++
        queueMicrotask(flushBack)
      }
      if (restore && document.contains(restore)) restore.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    if (url && history.state?.sheet && location.href !== new URL(url, location.href).href) history.replaceState(history.state, '', url)
  }, [url])

  const onDown = (ev: PointerEvent) => {
    drag.current = { y: ev.clientY, dy: 0 }
    ;(ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId)
  }
  const onMove = (ev: PointerEvent) => {
    if (!drag.current || !ref.current) return
    drag.current.dy = Math.max(0, ev.clientY - drag.current.y)
    ref.current.style.transform = `translateY(${drag.current.dy}px)`
  }
  const onUp = () => {
    const d = drag.current
    drag.current = null
    if (!ref.current) return
    ref.current.style.transform = ''
    if (d && d.dy > 90) closeRef.current()
  }

  const handle = (
    <div className="sheet-handle" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-hidden="true">
      <span />
    </div>
  )
  const common = {
    className: `sheet ${className}`.trim(),
    role: 'dialog',
    'aria-modal': true,
    'aria-label': label,
    tabIndex: -1,
    onClick: (ev: MouseEvent) => ev.stopPropagation(),
  } as const

  return createPortal(
    <div className="sheet-backdrop" onClick={() => closeRef.current()}>
      {onSubmit ? (
        <form {...common} ref={ref as RefObject<HTMLFormElement>} onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit() }}>
          {handle}
          {children}
        </form>
      ) : (
        <section {...common} ref={ref}>
          {handle}
          {children}
        </section>
      )}
    </div>,
    document.body,
  )
}

import { useLayoutEffect, useRef, useState } from 'react'

/** The rendered width of an element, kept current as it resizes. */
export function useWidth<T extends HTMLElement>(fallback = 600) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => { if (el.clientWidth > 0) setWidth(el.clientWidth) }
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

import type { Lang } from './profile'

export const LOCALE: Record<Lang, string> = { uz: 'uz-Latn-UZ', ru: 'ru-RU', en: 'en-GB' }

export function fmtDate(iso: string, lang: Lang, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y) return iso
  try {
    return new Intl.DateTimeFormat(LOCALE[lang], opts).format(new Date(y, (m || 1) - 1, d || 1))
  } catch {
    return iso
  }
}

export function fmtNum(n: number, lang: Lang, maxFrac = 1) {
  try {
    return new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: maxFrac }).format(n)
  } catch {
    return String(n)
  }
}

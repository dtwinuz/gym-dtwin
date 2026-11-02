import type { Lang } from './profile'

export const LOCALE: Record<Lang, string> = { uz: 'uz-Latn-UZ', ru: 'ru-RU', en: 'en-GB' }

const UZ_DAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba']
const UZ_DAYS_SHORT = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh']
const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
const UZ_MONTHS_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek']

/** Browsers often ship no Uzbek date data and print "M11", so Uzbek is formatted here. */
function fmtUz(date: Date, opts: Intl.DateTimeFormatOptions) {
  const dayMonth = [opts.day ? String(date.getDate()) : '', opts.month ? (opts.month === 'long' ? UZ_MONTHS : UZ_MONTHS_SHORT)[date.getMonth()] : '', opts.year ? String(date.getFullYear()) : '']
  const weekday = opts.weekday ? (opts.weekday === 'long' ? UZ_DAYS : UZ_DAYS_SHORT)[date.getDay()] : ''
  return [weekday, dayMonth.filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

export function fmtDate(iso: string, lang: Lang, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y) return iso
  if (lang === 'uz') return fmtUz(new Date(y, (m || 1) - 1, d || 1), opts)
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

/** Local weekday name; 2026-01-04 is a Sunday, so day n of that week is weekday n. */
export const weekdayName = (weekday: number, lang: Lang, style: 'long' | 'short' = 'long') =>
  fmtDate(`2026-01-${String(4 + weekday).padStart(2, '0')}`, lang, { weekday: style })

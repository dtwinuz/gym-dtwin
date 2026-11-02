export const ACCENTS = ['#c6f432', '#ffc640', '#ff7a45', '#ff4d5e', '#ff5fa2', '#9b7bff', '#4ea8ff', '#2fd3c7'] as const

export const THEME_BG = { dark: '#0f1012', light: '#f5f6f2' } as const

type RGB = [number, number, number]

export function parseHex(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const h = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1]
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as RGB
}

export const toHex = (c: RGB) => `#${c.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`

export function luminance([r, g, b]: RGB) {
  const ch = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}

export function contrast(a: string, b: string) {
  const ca = parseHex(a)
  const cb = parseHex(b)
  if (!ca || !cb) return 1
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function toHsl([r, g, b]: RGB): RGB {
  const [R, G, B] = [r / 255, g / 255, b / 255]
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4
  return [h / 6, s, l]
}

function fromHsl([h, s, l]: RGB): RGB {
  if (s === 0) return [l * 255, l * 255, l * 255]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t: number) => {
    const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]
}

/** Accent nudged in lightness (hue kept) until it reaches `min` contrast against the background. */
export function readableAccent(accent: string, bg: string, min = 4.5): string {
  const rgb = parseHex(accent)
  const bgRgb = parseHex(bg)
  if (!rgb || !bgRgb) return accent
  const base = toHex(rgb)
  if (contrast(base, bg) >= min) return base
  const [h, s, l] = toHsl(rgb)
  const darker = luminance(bgRgb) > 0.18
  for (let step = 1; step <= 100; step++) {
    const nl = darker ? l - step / 100 : l + step / 100
    if (nl < 0 || nl > 1) break
    const c = toHex(fromHsl([h, s, nl]))
    if (contrast(c, bg) >= min) return c
  }
  return darker ? '#000000' : '#ffffff'
}

/** Text colour to put on top of the accent: whichever of near-black / white reads better. */
export function accentInk(accent: string) {
  return contrast(accent, '#111111') >= contrast(accent, '#ffffff') ? '#111111' : '#ffffff'
}

export function accentTokens(accent: string, theme: 'dark' | 'light') {
  const a = readableAccent(accent, THEME_BG[theme])
  return { accent: a, ink: accentInk(a) }
}

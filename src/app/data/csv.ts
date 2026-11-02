const BOM = '﻿'
const DELIMS = [',', ';', '\t'] as const

export type Cell = string | number | null | undefined

/** Text a spreadsheet would run as a formula gets a leading quote. */
export const guardCell = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s)

function encodeCell(v: Cell): string {
  if (v == null) return ''
  if (typeof v === 'number') return String(v)
  const s = guardCell(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** RFC 4180 with a BOM, so Excel reads it as UTF-8. */
export const writeCsv = (rows: Cell[][]) => BOM + rows.map(r => r.map(encodeCell).join(',')).join('\r\n') + '\r\n'

/** The delimiter used most on the first line, outside quotes. */
export function detectDelimiter(text: string): string {
  const start = text.charCodeAt(0) === 0xfeff ? 1 : 0
  const sep = /^sep=(.)\r?\n/i.exec(text.slice(start, start + 10))
  if (sep) return sep[1]
  const counts = new Map<string, number>()
  let quoted = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (c === '"') quoted = !quoted
    else if (!quoted && (c === '\n' || c === '\r')) break
    else if (!quoted && (DELIMS as readonly string[]).includes(c)) counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  let best: string = DELIMS[0]
  for (const d of DELIMS) if ((counts.get(d) ?? 0) > (counts.get(best) ?? 0)) best = d
  return best
}

/** Rows one at a time; blank lines are dropped. A stray quote inside a field stays text. */
export function* csvRows(text: string, delim = detectDelimiter(text)): Generator<string[]> {
  const n = text.length
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0
  let row: string[] = []
  let field = ''
  let quoted = false
  while (i < n) {
    if (quoted) {
      const j = text.indexOf('"', i)
      if (j < 0) {
        field += text.slice(i)
        i = n
      } else if (text[j + 1] === '"') {
        field += `${text.slice(i, j)}"`
        i = j + 2
      } else {
        field += text.slice(i, j)
        quoted = false
        i = j + 1
      }
      continue
    }
    const c = text[i]
    if (c === '"' && field === '') {
      quoted = true
      i++
    } else if (c === delim) {
      row.push(field)
      field = ''
      i++
    } else if (c === '\n' || c === '\r') {
      i += c === '\r' && text[i + 1] === '\n' ? 2 : 1
      row.push(field)
      field = ''
      if (row.some(x => x !== '')) yield row
      row = []
    } else {
      let j = i + 1
      while (j < n && text[j] !== delim && text[j] !== '\n' && text[j] !== '\r') j++
      field += text.slice(i, j)
      i = j
    }
  }
  row.push(field)
  if (row.some(x => x !== '')) yield row
}

export const parseCsv = (text: string, delim?: string) => [...csvRows(text, delim)]

/** UTF-8 or UTF-16 by their marks; bytes that are not valid UTF-8 are read as Windows-1251. */
export function decodeBytes(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1251').decode(bytes)
  }
}

/** Lets the page breathe during long loops; call it often, it yields only when due. */
export function ticker(onProgress?: (done: number) => void, budgetMs = 24) {
  let last = Date.now()
  return async (done: number) => {
    if (Date.now() - last < budgetMs) return
    onProgress?.(done)
    await new Promise(r => setTimeout(r))
    last = Date.now()
  }
}
export type Tick = ReturnType<typeof ticker>

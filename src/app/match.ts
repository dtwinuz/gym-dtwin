const fold = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[‘’ʻʼ`]/g, "'").trim()

/** True when every word of the query appears in at least one of the labels. */
export function matchesLabels(labels: string[], query: string) {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const hay = labels.map(fold).join(' | ')
  return words.every(w => hay.includes(w))
}

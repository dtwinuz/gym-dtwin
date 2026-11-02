/**
 * Navigate after a sheet closes. Closing rewinds the sheet's history entry
 * asynchronously, and a hash set before that rewind would be undone by it.
 */
export function goAfterSheet(hash: string) {
  let done = false
  const run = () => {
    if (done) return
    done = true
    window.removeEventListener('popstate', run)
    location.hash = hash
  }
  window.addEventListener('popstate', run)
  setTimeout(run, 400)
}

export function downloadText(name: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** The query part of the hash route. */
export const hashQuery = () => new URLSearchParams(location.hash.split('?')[1] ?? '')

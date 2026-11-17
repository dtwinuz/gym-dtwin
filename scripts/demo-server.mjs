// Serves dist-demo/ under /demo/gym/ like the static host does: unknown paths fall back to index.html.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

export const BASE = '/demo/gym/'
const ROOT = fileURLToPath(new URL('../dist-demo/', import.meta.url))
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.woff2': 'font/woff2' }

export function serve(port = 4173) {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0])
    if (!path.startsWith(BASE)) {
      res.writeHead(302, { location: BASE }).end()
      return
    }
    let file = normalize(join(ROOT, path.slice(BASE.length)))
    if (!file.startsWith(normalize(ROOT))) return void res.writeHead(403).end()
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
    } catch {
      file = join(ROOT, 'index.html')
    }
    try {
      const body = await readFile(file)
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body)
    } catch {
      res.writeHead(404).end()
    }
  })
  return new Promise(resolve => server.listen(port, () => resolve(server)))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const port = Number(process.env.PORT ?? 4173)
  await serve(port)
  console.log(`demo on http://localhost:${port}${BASE}`)
}

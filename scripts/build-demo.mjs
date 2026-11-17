// Static demo build: `vite build --mode demo` into dist-demo/ (base /demo/gym/),
// then drop what the demo links to on the live site and shrink the exercise photos.
import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { build } from 'vite'

await build({ mode: 'demo' })
for (const dir of ['overview', 'deck']) rmSync(`dist-demo/${dir}`, { recursive: true, force: true })

const run = (cmd, args) => spawnSync(cmd, args, { stdio: 'inherit' })
const py = ['python3', 'python'].find(p => run(p, ['-I', '-c', 'import PIL']).status === 0)
if (py) run(py, ['-I', 'scripts/demo-images.py', 'dist-demo/ex'])
else console.warn('Pillow not found: demo keeps the full-size exercise photos')

// Screenshots of the static demo for the README: builds dist-demo/, serves it and
// writes 1440x900 JPEGs (plus one phone shot) to docs/screenshots/.
//   npm run site:screenshots            (build + shoot)
//   node scripts/site-screenshots.mjs --no-build
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { BASE, serve } from './demo-server.mjs'

if (!process.argv.includes('--no-build') && spawnSync('node', ['scripts/build-demo.mjs'], { stdio: 'inherit' }).status !== 0) process.exit(1)

const OUT = 'docs/screenshots'
mkdirSync(OUT, { recursive: true })
const port = 4179
const server = await serve(port)
const url = hash => `http://localhost:${port}${BASE}#${hash}`

const settle = page => page.waitForTimeout(700)

const SHOTS = [
  { name: 'home', hash: '/home' },
  { name: 'plan', hash: '/plan' },
  { name: 'routines', hash: '/plan/routines' },
  { name: 'routine-editor', hash: '/plan/routine/demo-r1' },
  {
    name: 'workout', hash: '/workout',
    run: async page => {
      await page.click('[data-start-today]')
      await page.waitForSelector('.logger')
      const checks = page.locator('.check')
      for (let i = 0; i < 5; i++) await checks.nth(i).click()
      await page.keyboard.press('Escape')
      await page.evaluate(() => window.scrollTo(0, 0))
    },
  },
  { name: 'exercises', hash: '/exercises' },
  { name: 'exercise-detail', hash: '/exercises/Barbell_Squat' },
  { name: 'stats', hash: '/progress' },
  { name: 'muscles', hash: '/progress/muscles' },
  { name: 'strength', hash: '/progress/strength' },
  { name: 'history', hash: '/progress/history' },
  {
    name: 'workout-detail', hash: '/progress/history',
    run: async page => { await page.locator('[data-open-workout]').first().click() },
  },
  { name: 'body', hash: '/progress/body' },
  { name: 'settings', hash: '/settings' },
]

// PW_CHROMIUM: an already installed Chromium, when the pinned one is not downloaded yet
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
try {
  for (const s of SHOTS) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' })
    const page = await ctx.newPage()
    await page.goto(url(s.hash))
    await page.waitForLoadState('networkidle')
    await settle(page)
    if (s.run) {
      await s.run(page)
      await settle(page)
    }
    await page.screenshot({ path: `${OUT}/${s.name}.jpg`, type: 'jpeg', quality: 78 })
    console.log(`${OUT}/${s.name}.jpg`)
    await ctx.close()
  }
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' })
  const page = await phone.newPage()
  await page.goto(url('/home'))
  await page.waitForLoadState('networkidle')
  await settle(page)
  await page.screenshot({ path: `${OUT}/phone.jpg`, type: 'jpeg', quality: 78 })
  console.log(`${OUT}/phone.jpg`)
  await phone.close()
} finally {
  await browser.close()
  server.close()
}

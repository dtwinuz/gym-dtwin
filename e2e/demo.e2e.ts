import { expect, test, type Page } from '@playwright/test'

const ROUTES: [string, RegExp][] = [
  ['/home', /Bugungi mashg'ulot|Shu hafta/],
  ['/plan', /dushanba/i],
  ['/plan/routines', /Yuqori A/],
  ['/plan/routine/demo-r1', /Mashq qo'shish/],
  ['/plan/print', /Yuqori A/],
  ['/workout', /Boshlash/],
  ['/exercises', /ta mashq/],
  ['/exercises/Barbell_Squat', /Mening natijalarim/],
  ['/progress', /Sessiyalar/],
  ['/progress/muscles', /set/],
  ['/progress/strength', /e1RM/],
  ['/progress/history', /Yuqori A/],
  ['/progress/body', /Tana vazni/],
  ['/settings', /Sozlamalar/],
]

function watch(page: Page) {
  const errors: string[] = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push(e.message))
  return errors
}

for (const [hash, text] of ROUTES) {
  test(`renders #${hash}`, async ({ page }) => {
    const errors = watch(page)
    await page.goto(`/demo/gym/#${hash}`)
    await expect(page.locator('body')).toContainText(text)
    await expect(page.locator('.demo-pill')).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('a workout can be logged and saved, and a reload brings the sample back', async ({ page }) => {
  const errors = watch(page)
  await page.goto('/demo/gym/#/progress/history')
  await expect(page.locator('[data-open-workout]').first()).toBeVisible()
  const before = await page.locator('[data-open-workout]').count()
  expect(before).toBeGreaterThan(60)
  await page.goto('/demo/gym/#/workout')
  await page.click('[data-start-today]')
  for (let i = 0; i < 4; i++) await page.locator('.check').nth(i).click()
  await page.locator('.sticky-bar .btn.primary').click()
  await page.locator('[data-save]').click()
  await page.goto('/demo/gym/#/progress/history')
  await expect(page.locator('[data-open-workout]')).toHaveCount(before + 1)
  await page.reload()
  await expect(page.locator('[data-open-workout]')).toHaveCount(before)
  expect(errors).toEqual([])
})

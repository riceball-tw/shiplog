import { expect, inbox, openApp, putNotes, test, theme, themeCards } from '../support/index.js'

test.beforeEach(async ({ page }) => {
  await putNotes(page, { themes: [theme('t1', 'Checkout', { tickets: ['CHK-7'] })], highlights: [] })
})

test('wide viewport: inbox and themes side by side with a resize handle', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await openApp(page)
  const handle = page.getByRole('separator')
  await expect(handle).toBeVisible()
  const i = (await inbox(page).boundingBox())!
  const c = (await themeCards(page).first().boundingBox())!
  expect(i.x + i.width).toBeLessThanOrEqual(c.x)

  // dragging the handle resizes the inbox
  const h = (await handle.boundingBox())!
  await page.mouse.move(h.x + h.width / 2, h.y + 40)
  await page.mouse.down()
  await page.mouse.move(h.x + h.width / 2 + 150, h.y + 40, { steps: 5 })
  await page.mouse.up()
  await expect.poll(async () => (await inbox(page).boundingBox())!.width).toBeGreaterThan(i.width + 80)
})

test('narrow viewport: Unassigned stacks above the themes, no handle', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 })
  await openApp(page)
  await expect(page.getByRole('separator')).toHaveCount(0)
  const i = (await inbox(page).boundingBox())!
  const c = (await themeCards(page).first().boundingBox())!
  expect(i.y + i.height).toBeLessThanOrEqual(c.y + 1)
})

import { expect, getNotes, openApp, test, themeCards, createTheme } from '../support/index.js'

/** Themes with no work in range sit in a collapsed section. */
async function showEmpty(page: import('@playwright/test').Page) {
  const toggle = page.getByRole('button', { name: /with no work in this range/ })
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
}

test('New theme dialog: Enter creates, Esc cancels', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: 'New theme' }).click()
  await expect(page.getByRole('dialog')).toContainText('New theme')
  await page.getByLabel('Name').fill('Discarded')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  expect((await getNotes(page)).themes).toHaveLength(0)

  await createTheme(page, 'Checkout speed')
  await expect.poll(async () => (await getNotes(page)).themes.map((t) => t.name)).toEqual(['Checkout speed'])
  await expect(page.getByRole('heading', { name: /Themes/ })).toContainText('(1)')
})

test('a blank name cannot be submitted', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: 'New theme' }).click()
  await expect(page.getByRole('button', { name: 'Create theme' })).toBeDisabled()
  await page.getByLabel('Name').fill('   ')
  await expect(page.getByRole('button', { name: 'Create theme' })).toBeDisabled()
})

test('rename inline and write an outcome; both persist across reload', async ({ page }) => {
  await openApp(page)
  await createTheme(page, 'Draft')
  await showEmpty(page)
  const card = themeCards(page).first()
  await card.getByLabel('Theme name').fill('Payments reliability')
  await card.getByLabel('Outcome').fill('Cut failed refunds by 40%')

  await expect
    .poll(async () => (await getNotes(page)).themes[0])
    .toMatchObject({ name: 'Payments reliability', outcome: 'Cut failed refunds by 40%' })

  await page.reload()
  await showEmpty(page)
  await expect(themeCards(page).first().getByLabel('Theme name')).toHaveValue('Payments reliability')
  await expect(themeCards(page).first().getByLabel('Outcome')).toHaveValue('Cut failed refunds by 40%')
})

test('delete asks for confirmation; Cancel keeps it, confirm removes it', async ({ page }) => {
  await openApp(page)
  await createTheme(page, 'Doomed')
  await expect.poll(async () => (await getNotes(page)).themes).toHaveLength(1)
  await showEmpty(page)

  await themeCards(page).first().getByRole('button', { name: 'Delete theme' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Delete theme "Doomed"?')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  await expect(themeCards(page)).toHaveCount(1)

  await themeCards(page).first().getByRole('button', { name: 'Delete theme' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete theme' }).click()
  await expect(themeCards(page)).toHaveCount(0)
  await expect.poll(async () => (await getNotes(page)).themes).toHaveLength(0)
})

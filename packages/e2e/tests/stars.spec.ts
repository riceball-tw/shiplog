import { COUNTS } from '../fixtures/data.js'
import { expect, getNotes, inboxRow, openApp, putNotes, tab, test, theme, themeCards } from '../support/index.js'

test('star a commit, assign its ticket, and it leads the theme card highlights', async ({ page }) => {
  await putNotes(page, { themes: [theme('t1', 'Payments')], highlights: [] })
  await openApp(page)

  await tab(page, /Commits/).click()
  const row = page.getByTestId('commit-list').locator('li').filter({ hasText: 'add refund endpoint' })
  const star = row.getByRole('button', { name: 'Highlight this commit' })
  await star.click()
  await expect(row.getByRole('button', { name: 'Remove highlight' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(async () => (await getNotes(page)).highlights).toHaveLength(1)
  // starring doesn't select the row or leave the tab
  await expect(page.getByTestId('commit-list')).toBeVisible()

  await tab(page, 'Story').click()
  await inboxRow(page, 'PAY-101').getByRole('combobox', { name: 'Add to theme' }).click()
  await page.getByRole('option', { name: 'Payments' }).click()

  const highlights = themeCards(page).first().getByRole('list', { name: 'Highlights' })
  await expect(highlights.getByRole('listitem')).toHaveCount(1)
  await expect(highlights).toContainText('add refund endpoint')
  await expect(highlights).toContainText('PAY-101')

  // unstarring from the card removes it again
  await highlights.getByRole('button', { name: 'Remove highlight' }).click()
  await expect(highlights).toHaveCount(0)
  await expect.poll(async () => (await getNotes(page)).highlights).toEqual([])
})

test('stars persist across a reload and show in the Commits tab', async ({ page }) => {
  await openApp(page)
  await tab(page, /Commits/).click()
  const list = page.getByTestId('commit-list')
  await list.locator('li').filter({ hasText: 'promo rounding' }).getByRole('button', { name: 'Highlight this commit' }).click()
  await expect.poll(async () => (await getNotes(page)).highlights).toHaveLength(1)
  await page.reload()
  await tab(page, /Commits/).click()
  await expect(list.getByRole('button', { name: 'Remove highlight' })).toHaveCount(1)
  await expect(list.getByRole('button', { name: 'Highlight this commit' })).toHaveCount(COUNTS.total - 1)
})

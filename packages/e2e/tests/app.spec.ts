import { COUNTS } from '../fixtures/data.js'
import { expect, openApp, tab, test } from '../support/index.js'

test('loads the timeline and counts only the configured author', async ({ page }) => {
  await openApp(page)
  await expect(page.getByTestId('timeline')).toBeVisible()
  const stats = page.getByTestId('timeline')
  await expect(stats.getByText('Commits', { exact: true })).toBeVisible()
  await expect(stats.locator('dt', { hasText: 'Commits' }).locator('xpath=following-sibling::dd[1]')).toHaveText(String(COUNTS.total))
  await expect(stats.locator('dt', { hasText: 'Repos' }).locator('xpath=following-sibling::dd[1]')).toHaveText(String(COUNTS.repos))
  // the other author's commits are not listed anywhere
  await tab(page, /Commits/).click()
  const list = page.getByTestId('commit-list')
  await expect(list).not.toContainText('webhook signing')
  await expect(list).not.toContainText('unrelated typo')
})

test('Story, Breakdown and Commits tabs switch', async ({ page }) => {
  await openApp(page)
  await expect(tab(page, 'Story')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('summary')).toBeVisible()

  await tab(page, 'Breakdown').click()
  await expect(page.getByTestId('breakdown')).toBeVisible()
  await expect(page.getByTestId('summary')).toBeHidden()

  await tab(page, /Commits/).click()
  await expect(page.getByTestId('commit-list')).toBeVisible()
  await expect(tab(page, /Commits/)).toContainText(`(${COUNTS.total})`)
  await expect(page.getByTestId('commit-list').locator('li')).toHaveCount(COUNTS.total)

  await tab(page, 'Story').click()
  await expect(page.getByTestId('summary')).toBeVisible()
})

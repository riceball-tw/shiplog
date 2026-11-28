import { COUNTS } from '../fixtures/data.js'
import { expect, inbox, inboxRow, openApp, tab, test } from '../support/index.js'

const noiseNote = (n: number) => `${n} noise commits hidden from the lists below`

test('Hide noise is on by default and toggles noise out of Story and Breakdown', async ({ page }) => {
  await openApp(page)
  const hide = page.getByLabel('Hide noise')
  await expect(hide).toBeChecked()

  const story = page.getByTestId('summary')
  await expect(story).toContainText(noiseNote(COUNTS.noise))
  await expect(inbox(page)).toContainText(`Unassigned (${COUNTS.keptGroups})`)
  await expect(inboxRow(page, /No ticket.*payments-api/)).toContainText('1 commit ')

  await hide.click()
  await expect(hide).not.toBeChecked()
  await expect(story).not.toContainText('noise commits hidden')
  // noise commits have no ticket: they join payments-api's No ticket row and add checkout-web's
  await expect(inbox(page)).toContainText(`Unassigned (${COUNTS.allGroups})`)
  await expect(inboxRow(page, /No ticket.*payments-api/)).toContainText('2 commits')

  await tab(page, 'Breakdown').click()
  await expect(page.getByTestId('breakdown')).not.toContainText('noise commits hidden')
  await hide.click()
  await expect(page.getByTestId('breakdown')).toContainText(noiseNote(COUNTS.noise))
})

test('the Commits tab is raw evidence: it lists noise either way', async ({ page }) => {
  await openApp(page)
  await tab(page, /Commits/).click()
  const list = page.getByTestId('commit-list')
  await expect(list.locator('li')).toHaveCount(COUNTS.total)
  await expect(list).toContainText('chore: bump dependencies')
  await page.getByLabel('Hide noise').click()
  await expect(list.locator('li')).toHaveCount(COUNTS.total)
})

test('the preference survives a reload', async ({ page }) => {
  await openApp(page)
  await page.getByLabel('Hide noise').click()
  await page.reload()
  await expect(page.getByLabel('Hide noise')).not.toBeChecked()
  await expect(page.getByTestId('summary')).not.toContainText('noise commits hidden')
})

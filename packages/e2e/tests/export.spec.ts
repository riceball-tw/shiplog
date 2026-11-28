import { readFile } from 'node:fs/promises'
import { expect, openApp, putNotes, tab, test, theme } from '../support/index.js'

const OUTCOME = 'Refunds now settle in minutes, not days'

test.beforeEach(async ({ page }) => {
  await putNotes(page, {
    themes: [theme('t1', 'Payments reliability', { outcome: OUTCOME, tickets: ['PAY-101', 'PAY-102'] })],
    highlights: [],
  })
  await openApp(page)
})

const openExport = async (page: import('@playwright/test').Page) => {
  await page.getByTestId('summary').getByRole('button', { name: 'Export' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Export story')
  return dialog
}

test('Story export: markdown has the theme heading, outcome and a mermaid gantt block', async ({ page }) => {
  const dialog = await openExport(page)
  const md = dialog.locator('pre')
  await expect(md).toContainText('### Payments reliability')
  await expect(md).toContainText(OUTCOME)
  await expect(md).toContainText('- **PAY-101**')
  await expect(md).toContainText('```mermaid')
  await expect(md).toContainText('gantt')
  await expect(md).toContainText('### Other work')
  // the rendered preview is there too
  await expect(dialog.locator('svg').first()).toBeVisible()
})

test('Include timeline toggles the mermaid block and the preview', async ({ page }) => {
  const dialog = await openExport(page)
  const toggle = dialog.getByLabel('Include timeline')
  await expect(toggle).toBeChecked()
  await toggle.click()
  await expect(dialog.locator('pre')).not.toContainText('```mermaid')
  await expect(dialog.locator('pre')).toContainText('### Payments reliability')
  await expect(dialog.getByRole('button', { name: 'Download SVG' })).toHaveCount(0)
  await toggle.click()
  await expect(dialog.locator('pre')).toContainText('```mermaid')
})

test('Copy Markdown puts the markdown on the clipboard', async ({ page }) => {
  const dialog = await openExport(page)
  const shown = (await dialog.locator('pre').innerText()).trim()
  await dialog.getByRole('button', { name: 'Copy Markdown' }).click()
  await expect(dialog.getByRole('button', { name: 'Copied ✓' })).toBeVisible()
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  expect(clip.trim()).toBe(shown)
  expect(clip).toContain('### Payments reliability')
})

test('Download SVG is a well-formed XML document', async ({ page }) => {
  const dialog = await openExport(page)
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Download SVG' }).click()])
  expect(download.suggestedFilename()).toMatch(/^shiplog-themes-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.svg$/)
  const svg = await readFile((await download.path())!, 'utf8')
  expect(svg.length).toBeGreaterThan(500)
  // parse in a real browser: a stray quote inside style="..." used to make this a parsererror
  const result = await page.evaluate((text) => {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
    return { error: doc.querySelector('parsererror')?.textContent ?? null, root: doc.documentElement.localName }
  }, svg)
  expect(result.error).toBeNull()
  expect(result.root).toBe('svg')
  // standalone: no unresolved theme variables left behind
  expect(svg).not.toContain('var(--pele-')
  expect(svg).not.toContain('var(--_')
})

test('Breakdown export (Ticket grouping) lists tickets without a timeline option', async ({ page }) => {
  await tab(page, 'Breakdown').click()
  await page.getByRole('button', { name: 'Ticket', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Ticket', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('breakdown').getByRole('button', { name: 'Export' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Export breakdown')
  await expect(dialog.getByLabel('Include timeline')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Download SVG' })).toHaveCount(0)
  const md = dialog.locator('pre')
  await expect(md).toContainText('### payments-api')
  await expect(md).toContainText('- **PAY-101**')
  await expect(md).toContainText('- **CHK-7**')
  await expect(md).not.toContainText('PAY-999') // the other author's ticket
  await dialog.getByRole('button', { name: 'Copy Markdown' }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('- **PAY-102**')
})

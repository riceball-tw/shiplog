import { expect, test as base, type Locator, type Page } from '@playwright/test'

export { expect }

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Covers every fixture commit (they are 2-20 days old). */
export function fixtureRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 29)
  return { from: ymd(from), to: ymd(to) }
}

export interface Notes {
  themes: { id: string; name: string; outcome: string; tickets: string[]; commits: string[]; repoIds: string[] }[]
  highlights: string[]
}

/** Opens the app on the fixture range, Story tab (prefs are per-context, so each test starts clean). */
export async function openApp(page: Page, path = '') {
  const { from, to } = fixtureRange()
  await page.goto(`/#/${path}?from=${from}&to=${to}`)
  await expect(page.getByTestId('timeline')).toBeVisible()
  await expect(page.getByTestId('range-label')).toBeVisible()
}

export const tab = (page: Page, name: RegExp | string) => page.getByRole('tab', { name })

/** `Unassigned` inbox rows (one per ticket / "No ticket" group). */
export const inbox = (page: Page) => page.getByTestId('unassigned')
export const inboxRow = (page: Page, text: string | RegExp) => inbox(page).locator('[data-row]').filter({ hasText: text })
export const themeCards = (page: Page) => page.getByTestId('theme-card')

export async function getNotes(page: Page): Promise<Notes> {
  return (await page.request.get('/api/notes')).json()
}
export async function putNotes(page: Page, notes: Notes) {
  const res = await page.request.put('/api/notes', { data: notes })
  expect(res.ok()).toBeTruthy()
}
export const theme = (id: string, name: string, extra: Partial<Notes['themes'][number]> = {}): Notes['themes'][number] => ({
  id,
  name,
  outcome: '',
  tickets: [],
  commits: [],
  repoIds: [],
  ...extra,
})

/** Create a theme through the New theme dialog. */
export async function createTheme(page: Page, name: string) {
  await page.getByRole('button', { name: 'New theme' }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Name').press('Enter')
  await expect(page.getByRole('dialog')).toBeHidden()
}

export async function inViewport(page: Page, loc: Locator) {
  const box = await loc.boundingBox()
  const vp = page.viewportSize()!
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width)
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height)
}

/**
 * HTML5 drag and drop by dispatching DragEvents with one shared DataTransfer. Playwright's `dragTo`
 * also works in Chromium (assign.spec uses it once) but moves the real mouse: it waits for the target
 * to be stable and hit-testable, which is slow/flaky when drop chips appear or rows re-render
 * mid-drag. This fires exactly the handlers the app listens to (dragstart, dragenter/over, drop).
 */
export async function dnd(source: Locator, target: Locator) {
  const dt = await source.page().evaluateHandle(() => new DataTransfer())
  await source.dispatchEvent('dragstart', { dataTransfer: dt })
  await target.dispatchEvent('dragenter', { dataTransfer: dt })
  await target.dispatchEvent('dragover', { dataTransfer: dt })
  await target.dispatchEvent('drop', { dataTransfer: dt })
  // no dragend: the source row is usually gone by now, and the app also ends the drag on window `drop`
}

/** Every test starts with empty notes (shared server, shared notes.json). */
export const test = base.extend<{ reset: void }>({
  reset: [
    async ({ request }, use) => {
      const res = await request.put('/api/notes', { data: { themes: [], highlights: [] } })
      expect(res.ok()).toBeTruthy()
      await use()
    },
    { auto: true },
  ],
})

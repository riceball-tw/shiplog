import { COUNTS } from '../fixtures/data.js'
import { expect, fixtureRange, openApp, putNotes, test, theme } from '../support/index.js'

// title, overview, 2 themes with work, Other work (noise is hidden by default)
const SLIDES = 5

test.beforeEach(async ({ page }) => {
  await putNotes(page, {
    themes: [
      theme('t1', 'Payments reliability', { outcome: 'Refunds settle in minutes', tickets: ['PAY-101', 'PAY-102'] }),
      theme('t2', 'Cart polish', { tickets: ['CHK-7'] }),
      theme('t3', 'Not in range'), // no work: gets no slide
    ],
    highlights: [],
  })
  await openApp(page)
  await page.getByRole('button', { name: 'Present' }).click()
})

const stage = (page: import('@playwright/test').Page) => page.getByTestId('present').locator('main')
const counter = (page: import('@playwright/test').Page, i: number) => expect(page.getByTestId('present')).toContainText(`${i} / ${SLIDES}`)

test('opens at the title slide with the headline numbers', async ({ page }) => {
  await expect(page.getByTestId('present')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`#/present\\?from=${fixtureRange().from}&to=${fixtureRange().to}`))
  await counter(page, 1)
  await expect(stage(page)).toHaveAttribute('aria-label', `Slide 1 of ${SLIDES}: Title`)
  await expect(stage(page).getByRole('heading', { level: 1 })).toBeVisible()
  await expect(stage(page).getByText('E2E User')).toBeVisible()
  await expect(stage(page).getByText(`${COUNTS.kept} commits`)).toBeVisible()
})

test('arrow keys, Home and End walk through every slide', async ({ page }) => {
  const label = (i: number, what: string) => `Slide ${i} of ${SLIDES}: ${what}`
  await page.keyboard.press('ArrowRight')
  await expect(stage(page)).toHaveAttribute('aria-label', label(2, 'Timeline overview'))
  await expect(page.getByRole('heading', { name: 'The year in themes' })).toBeVisible()

  await page.keyboard.press('ArrowRight')
  await expect(stage(page)).toHaveAttribute('aria-label', label(3, 'Payments reliability'))
  await expect(stage(page)).toContainText('Refunds settle in minutes')
  await expect(stage(page)).toContainText('PAY-101')

  await page.keyboard.press('ArrowRight')
  await expect(stage(page)).toHaveAttribute('aria-label', label(4, 'Cart polish'))
  await expect(stage(page)).toContainText('No outcome written yet')

  await page.keyboard.press('ArrowRight')
  await expect(stage(page)).toHaveAttribute('aria-label', label(5, 'Other work'))
  await expect(stage(page).getByRole('heading', { name: 'Other work' })).toBeVisible()
  await expect(stage(page)).toContainText('No ticket')

  await page.keyboard.press('ArrowRight') // clamps at the end
  await counter(page, SLIDES)

  await page.keyboard.press('ArrowLeft')
  await counter(page, SLIDES - 1)
  await page.keyboard.press('Home')
  await counter(page, 1)
  await page.keyboard.press('ArrowLeft') // clamps at the start
  await counter(page, 1)
  await page.keyboard.press('End')
  await counter(page, SLIDES)
})

test('the slide number lives in the URL and survives a reload', async ({ page }) => {
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(/slide=3/)
  await page.reload()
  await counter(page, 3)
  await expect(stage(page)).toHaveAttribute('aria-label', `Slide 3 of ${SLIDES}: Payments reliability`)
})

test('Esc returns to the main view with the same range', async ({ page }) => {
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('present')).toBeHidden()
  await expect(page.getByTestId('timeline')).toBeVisible()
  const { from, to } = fixtureRange()
  await expect(page).toHaveURL(new RegExp(`#/\\?from=${from}&to=${to}`))
  await expect(page.getByTestId('summary')).toBeVisible()
})

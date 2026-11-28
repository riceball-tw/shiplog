import {
  dnd, expect, getNotes, inViewport, inbox, inboxRow, openApp, putNotes, test, theme, themeCards,
} from '../support/index.js'

const ticketsOf = async (page: import('@playwright/test').Page, i = 0) => (await getNotes(page)).themes[i]?.tickets.slice().sort()

test('Add to theme menu opens inside the viewport and files the ticket', async ({ page }) => {
  await putNotes(page, { themes: [theme('t1', 'Payments')], highlights: [] })
  await openApp(page)
  // the last row sits lowest on screen: the menu used to open off-screen
  const rows = inbox(page).locator('[data-row]')
  await rows.last().getByRole('combobox', { name: 'Add to theme' }).click()
  const menu = page.getByRole('listbox')
  await expect(menu).toBeVisible()
  await inViewport(page, menu)
  await expect(menu.getByRole('option')).toHaveText(['Payments', 'New theme…'])
  await inViewport(page, menu.getByRole('option', { name: 'Payments' }))
  await menu.getByRole('option', { name: 'Payments' }).click()

  await expect(page.getByTestId('undo-toast')).toContainText('Moved 1 item to Payments')
  await expect.poll(() => getNotes(page).then((n) => n.themes[0]!.tickets.length + n.themes[0]!.commits.length)).toBe(1)
})

test('Add to theme menu: New theme… opens the dialog and files the work there', async ({ page }) => {
  await openApp(page)
  await inboxRow(page, 'PAY-101').getByRole('combobox', { name: 'Add to theme' }).click()
  await page.getByRole('option', { name: 'New theme…' }).click()
  await page.getByLabel('Name').fill('Refunds')
  await page.getByLabel('Name').press('Enter')
  await expect.poll(async () => (await getNotes(page)).themes.map((t) => [t.name, t.tickets])).toEqual([['Refunds', ['PAY-101']]])
  await expect(inboxRow(page, 'PAY-101')).toHaveCount(0)
})

test('drag a ticket row onto a theme card (native drag via dragTo)', async ({ page }) => {
  await putNotes(page, { themes: [theme('t1', 'Checkout', { tickets: ['CHK-7'] })], highlights: [] })
  await openApp(page)
  await inboxRow(page, 'PAY-101').dragTo(themeCards(page).first())
  await expect.poll(() => ticketsOf(page)).toEqual(['CHK-7', 'PAY-101'])
  await expect(inboxRow(page, 'PAY-101')).toHaveCount(0)
})

test('drag onto a collapsed theme chip', async ({ page }) => {
  await putNotes(page, { themes: [theme('t1', 'Empty one')], highlights: [] })
  await openApp(page)
  await dnd(inboxRow(page, 'CHK-7'), page.getByTestId('theme-drop-zone').filter({ hasText: 'Empty one' }))
  await expect.poll(() => ticketsOf(page)).toEqual(['CHK-7'])
})

test('keyboard: focus an inbox row and press 1', async ({ page }) => {
  await putNotes(page, { themes: [theme('t1', 'First'), theme('t2', 'Second')], highlights: [] })
  await openApp(page)
  const row = inboxRow(page, 'PAY-102')
  await row.focus()
  // number badges appear on the theme cards... only for themes with work; the key works regardless
  await page.keyboard.press('2')
  await expect.poll(() => ticketsOf(page, 1)).toEqual(['PAY-102'])
  expect(await ticketsOf(page, 0)).toEqual([])
  await expect(inboxRow(page, 'PAY-102')).toHaveCount(0)
})

test('keyboard: N on a focused row creates a theme for it', async ({ page }) => {
  await openApp(page)
  await inboxRow(page, 'CHK-7').focus()
  await page.keyboard.press('n')
  await page.getByLabel('Name').fill('Cart')
  await page.getByLabel('Name').press('Enter')
  await expect.poll(async () => (await getNotes(page)).themes.map((t) => [t.name, t.tickets])).toEqual([['Cart', ['CHK-7']]])
})

test('multi-select with Ctrl/Meta-click then drag moves both rows', async ({ page }) => {
  await putNotes(page, { themes: [theme('t1', 'Payments', { tickets: ['PAY-101'] })], highlights: [] })
  await openApp(page)
  const a = inboxRow(page, 'CHK-7')
  const b = inboxRow(page, 'PAY-102')
  await a.click({ modifiers: ['ControlOrMeta'] })
  await b.click({ modifiers: ['ControlOrMeta'] })
  await expect(inbox(page)).toContainText('2 selected')
  await dnd(a, themeCards(page).first())
  await expect(page.getByTestId('undo-toast')).toContainText('Moved 2 items to Payments')
  await expect.poll(() => ticketsOf(page)).toEqual(['CHK-7', 'PAY-101', 'PAY-102'])
})

test('Undo restores the previous assignment', async ({ page }) => {
  await putNotes(page, { themes: [theme('t1', 'Payments', { tickets: ['PAY-101'] })], highlights: [] })
  await openApp(page)
  await dnd(inboxRow(page, 'CHK-7'), themeCards(page).first())
  await expect(inboxRow(page, 'CHK-7')).toHaveCount(0)
  await page.getByTestId('undo-toast').getByRole('button', { name: 'Undo' }).click()
  await expect(inboxRow(page, 'CHK-7')).toHaveCount(1)
  await expect(page.getByTestId('undo-toast')).toBeHidden()
  await expect.poll(() => ticketsOf(page)).toEqual(['PAY-101'])
})

test('dropping on "+ New theme" creates a theme holding the work', async ({ page }) => {
  await openApp(page)
  await dnd(inboxRow(page, 'PAY-101'), page.getByTestId('theme-drop-zone').filter({ hasText: '+ New theme' }))
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel('Name').fill('Dropped')
  await page.getByLabel('Name').press('Enter')
  await expect.poll(async () => (await getNotes(page)).themes.map((t) => [t.name, t.tickets])).toEqual([['Dropped', ['PAY-101']]])
  await expect(themeCards(page)).toHaveCount(1)
})

test('the Remove button takes a ticket back to Unassigned', async ({ page }) => {
  await putNotes(page, { themes: [theme('t1', 'Payments', { tickets: ['PAY-101'] })], highlights: [] })
  await openApp(page)
  await expect(inboxRow(page, 'PAY-101')).toHaveCount(0)
  await themeCards(page).first().getByRole('button', { name: /Work in this theme/ }).click()
  await page.getByRole('button', { name: 'Remove PAY-101 from theme' }).click()
  await expect(inboxRow(page, 'PAY-101')).toHaveCount(1)
  await expect.poll(() => ticketsOf(page)).toEqual([])
})


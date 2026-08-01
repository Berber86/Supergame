import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')
})

test('mobile game uses three compact screens instead of one long page', async ({ page }) => {
  await page.getByRole('button', { name: /Начать путешествие/i }).click()
  await expect(page.getByRole('dialog', { name: /Как мойры сплетут ваш путь/i })).toBeVisible()
  await page.getByRole('button', { name: /Одиссея Каноническое испытание/i }).click()
  await page.getByRole('button', { name: /Начать путешествие/i }).click()

  await expect(page.getByRole('navigation', { name: 'Разделы игры' })).toBeVisible()
  await expect(page.locator('.encounter-panel')).toBeVisible()
  await expect(page.locator('.choice-button')).toHaveCount(2)
  await expect(page.getByRole('button', { name: /Первые два решения мне не подходят/i })).toBeVisible()
  await expect(page.locator('.hero-panel')).toBeHidden()
  await expect(page.locator('.world-panel')).toBeHidden()

  await page.getByRole('button', { name: 'Герой' }).click()
  await expect(page.locator('.hero-panel')).toBeVisible()
  await expect(page.locator('.encounter-panel')).toBeHidden()

  await page.getByRole('button', { name: 'Мир' }).click()
  await expect(page.locator('.world-panel')).toBeVisible()
  await expect(page.locator('.hero-panel')).toBeHidden()

  const mapTab = page.getByRole('tab', { name: 'Карта' })
  await mapTab.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Судно' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel')).toContainText('Чёрная ласточка')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Песни' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel')).toContainText('Песни экипажа')
})

test('event consequence leads directly to the relevant crew screen', async ({ page }) => {
  await page.getByRole('button', { name: /Начать путешествие/i }).click()
  await page.getByRole('button', { name: /Начать путешествие/i }).click()
  await page.locator('.choice-button').first().click()

  const crewLink = page.getByRole('button', { name: /Посмотреть память спутников|Открыть долги и команду/i })
  await expect(crewLink).toBeVisible()
  await crewLink.click()
  await expect(page.locator('.world-panel')).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Судно' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('СПУТНИКИ И ИХ ПАМЯТЬ')).toBeVisible()
})

test('port exposes an explicit departure action above the market', async ({ page }) => {
  await page.getByRole('button', { name: /Начать путешествие/i }).click()
  await page.getByRole('button', { name: /Начать путешествие/i }).click()
  await page.waitForFunction(() => Boolean(localStorage.getItem('odyssey-shadow-save-v9')))
  await page.evaluate(() => {
    const key = 'odyssey-shadow-save-v9'
    const run = JSON.parse(localStorage.getItem(key)!)
    run.nodeIndex = 3
    run.phase = 'port'
    run.resolution = null
    localStorage.setItem(key, JSON.stringify(run))
  })
  await page.reload()
  await page.getByRole('button', { name: /Продолжить путь/i }).click()

  await expect(page.getByText('КОРАБЛЬ ГОТОВ К ОТПЛЫТИЮ')).toBeVisible()
  await expect(page.getByRole('button', { name: /Уплыть прямым курсом/i }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Уплыть осторожно/i }).first()).toBeVisible()
})

test('dialog traps focus, closes with Escape and restores the trigger', async ({ page }) => {
  const settingsButton = page.getByRole('button', { name: 'Настройки интерфейса' })
  await settingsButton.click()

  const dialog = page.getByRole('dialog', { name: 'Настройки чтения' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('aria-modal', 'true')

  const firstButton = dialog.getByRole('button').first()
  const lastButton = dialog.getByRole('button').last()
  await lastButton.focus()
  await page.keyboard.press('Tab')
  await expect(firstButton).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(settingsButton).toBeFocused()
})

test('chronicle exposes semantic tabs navigable with arrow keys', async ({ page }) => {
  await page.getByRole('button', { name: /Летопись/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Летопись Одиссея' })
  await expect(dialog).toBeVisible()

  const overview = dialog.getByRole('tab', { name: 'Обзор' })
  await overview.focus()
  await page.keyboard.press('End')
  await expect(dialog.getByRole('tab', { name: 'Данные' })).toHaveAttribute('aria-selected', 'true')
  await expect(dialog.getByRole('tabpanel')).toContainText('Экспортировать летопись')
})

import { expect, test } from '@playwright/test'

test('dashboard shows Healthy when the API is up', async ({ page }) => {
  await page.route('**/api/health', (route) => route.fulfill({ status: 200, body: 'Healthy' }))
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByTestId('api-health')).toHaveText('Healthy')
})

test('dashboard shows Unhealthy when the database is down', async ({ page }) => {
  await page.route('**/api/health', (route) => route.fulfill({ status: 503, body: 'Unhealthy' }))
  await page.goto('/')

  await expect(page.getByTestId('api-health')).toHaveText('Unhealthy')
})

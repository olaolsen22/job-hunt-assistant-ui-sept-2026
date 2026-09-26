import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { id: '1', email: 'owner@example.com', role: 'Owner' } })
  )
})

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

test('logs out from the header', async ({ page }) => {
  await page.route('**/api/auth/logout', (route) => route.fulfill({ status: 204 }))
  await page.goto('/')

  await expect(page.getByTestId('current-user')).toHaveText('owner@example.com')
  // The session is gone after logout, so the middleware's /me check must fail like the real API.
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401 }))
  await page.getByRole('button', { name: 'Log out' }).click()

  await expect(page).toHaveURL('/login')
})

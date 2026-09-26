import { expect, test } from '@playwright/test'

const guest = { id: '2', email: 'guest@example.com', role: 'Guest' }

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401 }))
})

test('redirects to login and signs in as guest', async ({ page }) => {
  await page.route('**/api/auth/guest', (route) =>
    route.fulfill({ json: { requiresTwoFactor: false, user: guest } })
  )
  await page.goto('/')

  await expect(page).toHaveURL('/login')
  await page.getByRole('button', { name: 'Continue as guest' }).click()

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})

test('shows an error for wrong credentials', async ({ page }) => {
  await page.route('**/api/auth/login', (route) => route.fulfill({ status: 401 }))
  await page.goto('/login')

  await page.getByLabel('Email').fill('owner@example.com')
  await page.getByLabel('Password', { exact: true }).fill('wrong')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByTestId('login-error')).toHaveText('Invalid email or password.')
})

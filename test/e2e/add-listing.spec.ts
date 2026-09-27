import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { id: '1', email: 'owner@example.com', role: 'Owner' } })
  )
})

test('adds a listing and returns to the list', async ({ page }) => {
  let listing: Record<string, unknown> | undefined
  await page.route('**/graphql', (route) => {
    const { query, variables } = route.request().postDataJSON()
    if (query.includes('CreateListing')) {
      listing = variables.listing
      return route.fulfill({
        json: { data: { createListing: { listing: { id: 1 }, errors: null } } }
      })
    }
    const name = query.includes('JobRoleSearch') ? 'Developer' : 'Acme'
    return route.fulfill({ json: { data: { result: { nodes: [{ name }] } } } })
  })
  await page.goto('/listings/add')

  await page.getByLabel('Job title').fill('Frontend Developer')
  await page.getByRole('combobox', { name: 'Company' }).click()
  await page.getByRole('option', { name: 'Acme', exact: true }).click()
  await page.getByRole('combobox', { name: 'Role' }).click()
  await page.getByRole('option', { name: 'Developer', exact: true }).click()
  await page.getByLabel('Job ad URL').fill('https://example.com/job')
  await page.getByRole('button', { name: 'Add listing' }).click()
  await page.getByTestId('confirm-modal-confirm').click()

  await expect(page).toHaveURL('/listings')
  await expect(page.getByText('Listing added', { exact: true })).toBeVisible()
  expect(listing).toMatchObject({
    title: 'Frontend Developer',
    companyName: 'Acme',
    jobRoleName: 'Developer',
    url: 'https://example.com/job'
  })
})

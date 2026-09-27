import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { id: '1', email: 'owner@example.com', role: 'Owner' } })
  )
})

test('parses an AI reply into rows and saves them independently', async ({ page }) => {
  let variables: Record<string, Record<string, unknown>> | undefined
  await page.route('**/graphql', (route) => {
    const body = route.request().postDataJSON()
    if (body.query.includes('ListingQuickParsePrompt')) {
      return route.fulfill({
        json: { data: { listingQuickParsePrompt: { instructions: 'Parse these.' } } }
      })
    }
    if (body.query.includes('QuickAddListings')) {
      variables = body.variables
      return route.fulfill({
        json: {
          data: {
            r0: {
              listing: { id: 7, title: 'Frontend Developer', url: 'https://example.com/a' },
              possibleDuplicates: [],
              errors: null
            },
            r1: {
              listing: null,
              possibleDuplicates: null,
              errors: [
                {
                  __typename: 'DuplicateListingError',
                  message: 'You already have a listing with this URL.',
                  existingListingId: 3
                }
              ]
            }
          }
        }
      })
    }
    return route.fulfill({
      json: { data: { companies: { nodes: [] }, jobRoles: { nodes: [] } } }
    })
  })
  await page.goto('/listings/quick-add')

  const reply = [
    {
      title: 'Frontend Developer',
      companyName: 'Acme',
      jobRoleName: 'Developer',
      url: 'https://example.com/a/?utm_source=x',
      postedOn: null,
      deadlineType: 'ROLLING',
      locations: [{ countryCode: 'NO', city: 'Oslo' }]
    },
    { title: 'Backend Developer', companyName: 'Acme', jobRoleName: 'Developer', url: null }
  ]
  // AIs often wrap the JSON in a code fence.
  await page.getByTestId('quick-add-json').fill('```json\n' + JSON.stringify(reply) + '\n```')
  await page.getByTestId('quick-add-parse').click()

  await expect(page.getByTestId('quick-add-row')).toHaveCount(2)
  await expect(page.getByTestId('quick-add-row-locations')).toHaveText('Oslo, NO')
  // The missing url is flagged right after parsing.
  await expect(page.getByText('Enter an http(s) link')).toBeVisible()
  await page.getByLabel('Job ad URL').nth(1).fill('https://example.com/b')
  await expect(page.getByText('Enter an http(s) link')).toBeHidden()
  await page.getByTestId('quick-add-save').click()

  await expect(page.getByTestId('quick-add-row-saved')).toContainText('https://example.com/a')
  // Checked after a result shows, so the request has been sent.
  expect(variables?.l0).toMatchObject({
    deadlineType: 'ROLLING',
    locations: [{ countryCode: 'NO', city: 'Oslo' }]
  })
  await expect(page.getByTestId('quick-add-row-error')).toContainText('already have a listing')
  await expect(page.getByRole('link', { name: 'View the existing listing' })).toHaveAttribute(
    'href',
    '/listings/3'
  )
})

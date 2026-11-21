import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { id: '1', email: 'owner@example.com', role: 'Owner' } })
  )
})

test('previews a parsed company list, fixes a row and saves it in one request', async ({
  page
}) => {
  let sent: unknown
  await page.route('**/graphql', (route) => {
    const body = route.request().postDataJSON()
    if (body.query.includes('CompanyParsePrompt')) {
      return route.fulfill({ json: { data: { prompt: { instructions: 'Parse these.' } } } })
    }
    if (body.query.includes('CreateCompanies')) {
      sent = body.variables.companies
      return route.fulfill({
        json: {
          data: {
            createCompanies: {
              results: [
                { created: true, company: { id: 1, name: 'Bekk' } },
                { created: false, company: { id: 2, name: 'Vipps' } }
              ],
              errors: null
            }
          }
        }
      })
    }
    return route.fulfill({ json: { data: { result: { nodes: [] } } } })
  })
  await page.goto('/companies/add')

  const reply = [
    { name: 'Bekk', industryName: 'Consulting', locations: [{ city: 'Oslo', countryCode: 'NO' }] },
    // The AI couldn't name this one. It has an industry, so it isn't a blank row (those are skipped).
    { name: null, industryName: 'Retail', locations: [] },
    { name: 'Vipps', industryName: null, locations: [] }
  ]
  await page.getByTestId('companies-add-paste').click()
  await page.getByRole('tab', { name: 'Your own AI' }).click()
  await page.getByTestId('companies-parse-json').fill('```json\n' + JSON.stringify(reply) + '\n```')
  await page.getByTestId('companies-parse-apply').click()

  await expect(page.getByTestId('companies-add-row')).toHaveCount(3)
  // The missing name is flagged right after parsing.
  await expect(page.getByText('Required')).toHaveCount(1)

  await page.getByTestId('companies-add-row-remove').nth(1).click()
  await expect(page.getByTestId('companies-add-row')).toHaveCount(2)
  await page.getByTestId('companies-add-save').click()

  await expect(page.getByTestId('companies-add-row-saved')).toHaveCount(1)
  await expect(page.getByTestId('companies-add-row-existing')).toContainText('Already existed')
  // Rows also carry the (here empty) research fields.
  expect(sent).toMatchObject([
    { name: 'Bekk', industryName: 'Consulting', locations: [{ city: 'Oslo', countryCode: 'NO' }] },
    { name: 'Vipps', industryName: null, locations: [] }
  ])
})

test('researches companies picked on the list: names reach the paste modal and save as enriched', async ({
  page
}) => {
  let sent: { name: string }[] = []
  await page.route('**/graphql', (route) => {
    const body = route.request().postDataJSON()
    if (body.query.includes('CompanyParsePrompt')) {
      return route.fulfill({ json: { data: { prompt: { instructions: 'Parse these.' } } } })
    }
    if (body.query.includes('CreateCompanies')) {
      sent = body.variables.companies
      return route.fulfill({
        json: {
          data: {
            createCompanies: {
              results: [{ created: false, filled: true, company: { id: 1, name: 'Bekk' } }],
              errors: null
            }
          }
        }
      })
    }
    if (body.query.includes('query Companies')) {
      return route.fulfill({
        json: {
          data: {
            companies: {
              nodes: [1, 2].map((id) => ({
                id,
                name: id === 1 ? 'Bekk' : 'Vipps',
                kind: null,
                avoidedAt: null,
                favoritedAt: null,
                sizeBand: null,
                listingCount: 0,
                applicationCount: 0,
                kind: null,
                industry: null,
                locations: [],
                contacts: []
              })),
              pageInfo: { hasNextPage: false, endCursor: null },
              totalCount: 2
            }
          }
        }
      })
    }
    return route.fulfill({ json: { data: { result: { nodes: [] } } } })
  })
  await page.goto('/companies')

  await page.getByRole('checkbox', { name: 'Select Bekk' }).click()
  await page.getByTestId('companies-research-selected').click()

  await expect(page.getByTestId('companies-parse-text')).toHaveValue('Bekk')
  await page.getByRole('tab', { name: 'Your own AI' }).click()
  await page.getByTestId('companies-parse-json').fill('[{"name":"Bekk","kind":"CONSULTANCY"}]')
  await page.getByTestId('companies-parse-apply').click()

  await expect(page.getByTestId('companies-add-row-existing-note')).toBeVisible()
  await page.getByTestId('companies-add-save').click()
  await expect(page.getByTestId('companies-add-row-enriched')).toContainText('filled in missing')
  expect(sent).toMatchObject([{ name: 'Bekk', kind: 'CONSULTANCY' }])
})

import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { id: '1', email: 'owner@example.com', role: 'Owner' } })
  )
})

const item = (id: number, title: string) => ({
  id,
  title,
  company: { name: 'Acme' },
  locations: [],
  postedOn: '2026-10-01',
  deadlineType: 'ASAP',
  deadlineOn: null,
  dueOn: '2026-10-15',
  url: `https://example.com/${id}`,
  favoritedAt: null,
  analyzedAt: '2026-10-01T10:00:00Z',
  status: 'SAVED',
  jobRole: { name: 'Developer' }
})

// The query is built at runtime and printed one argument per line; the main field is the one without
// an alias.
const mainArgs = (query: string) => query.match(/\n\s*listings\(([^)]*)\)/)![1]

test('searches listings and filters by closing soon', async ({ page }) => {
  const searches: unknown[] = []
  await page.route('**/graphql', (route) => {
    const { query, variables } = route.request().postDataJSON()
    searches.push(variables.search)
    const items = variables.search
      ? [item(1, 'Frontend Developer')]
      : mainArgs(query).includes('dueWithinDays')
        ? [item(2, 'Backend Developer')]
        : [item(1, 'Frontend Developer'), item(2, 'Backend Developer')]
    return route.fulfill({
      json: {
        data: {
          listings: { items, totalCount: items.length },
          toAnalyze: { totalCount: 0 },
          archived: { totalCount: 0 },
          closingSoon: { totalCount: 1 }
        }
      }
    })
  })

  await page.goto('/listings')
  await expect(page.getByTestId('listings-total')).toHaveText('2 active listings')

  await page.getByTestId('listings-filter-closingSoon').click()
  await expect(page.getByTestId('listings-total')).toHaveText('1 active listing')

  await page.getByTestId('listings-search').fill('frontend')
  await expect.poll(() => searches.at(-1)).toBe('frontend')
  await expect(page.getByTestId('listings-grid')).toContainText('Frontend Developer')

  await page.getByTestId('listings-search-clear').click()
  await expect.poll(() => searches.at(-1)).toBeNull()
})

test('filters by status', async ({ page }) => {
  await page.route('**/graphql', (route) => {
    const { variables } = route.request().postDataJSON()
    const items = variables.statuses
      ? [{ ...item(1, 'Frontend Developer'), status: 'APPLIED' }]
      : [item(1, 'Frontend Developer'), item(2, 'Backend Developer')]
    return route.fulfill({
      json: {
        data: {
          listings: { items, totalCount: items.length },
          toAnalyze: { totalCount: 0 },
          archived: { totalCount: 0 },
          closingSoon: { totalCount: 0 }
        }
      }
    })
  })

  await page.goto('/listings')
  await expect(page.getByTestId('listings-total')).toHaveText('2 active listings')

  await page.getByTestId('listings-facet-status').click()
  await page.getByRole('option', { name: 'Applied' }).click()
  await expect(page.getByTestId('listings-total')).toHaveText('1 active listing')

  await page.keyboard.press('Escape')
  await page.getByTestId('listings-filters-clear').click()
  await expect(page.getByTestId('listings-total')).toHaveText('2 active listings')
})

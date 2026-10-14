import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { id: '1', email: 'owner@example.com', role: 'Owner' } })
  )
})

const listing = (applied: boolean) => ({
  id: 5,
  title: 'Frontend Developer',
  company: { id: 3, name: 'Acme', applicationCount: applied ? 1 : 0, avoidedAt: null },
  jobRole: { name: 'Frontend' },
  seniority: null,
  employmentType: null,
  schedule: null,
  workMode: null,
  description: null,
  url: 'https://example.com/a',
  postedOn: '2026-09-20',
  deadlineType: 'ASAP',
  deadlineOn: null,
  dueOn: '2026-10-04',
  postingLanguage: null,
  favoritedAt: null,
  analyzedAt: null,
  archivedAt: null,
  status: applied ? 'APPLIED' : 'SAVED',
  statusHistory: applied
    ? [{ id: 1, status: 'APPLIED', occurredAt: '2026-09-27T10:00:00Z', note: null }]
    : [],
  interviews: [],
  documents: [
    {
      id: 9,
      kind: 'CV',
      fileName: 'cv.pdf',
      createdAt: '2026-09-25T10:00:00Z',
      sentAt: applied ? '2026-09-27T10:00:00Z' : null
    }
  ],
  locations: [],
  languages: [],
  skills: [],
  contacts: []
})

test('applies with an uploaded CV and shows the new status', async ({ page }) => {
  let applyInput: Record<string, unknown> | undefined
  await page.route('**/graphql', (route) => {
    const body = route.request().postDataJSON()
    if (body.query.includes('ApplyToListing')) {
      applyInput = body.variables.input
      return route.fulfill({
        json: { data: { applyToListing: { listing: { id: 5 }, errors: null } } }
      })
    }
    return route.fulfill({ json: { data: { listingById: listing(!!applyInput) } } })
  })

  await page.goto('/listings/5')
  await page.getByTestId('listing-apply').click()
  await page.getByRole('dialog').getByRole('combobox').click()
  await page.getByRole('option', { name: 'cv.pdf' }).click()
  await page.getByTestId('confirm-modal-confirm').click()

  await expect(page.getByTestId('listing-status')).toHaveText('Applied')
  await expect(page.getByTestId('status-timeline')).toContainText('Applied')
  expect(applyInput).toMatchObject({ listingId: 5, cvDocumentId: 9, coverLetterDocumentId: null })
})

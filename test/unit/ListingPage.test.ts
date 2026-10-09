import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import ListingPage from '~/pages/listings/[id]/index.vue'

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))

const listing = {
  id: 5,
  title: 'Frontend Developer',
  company: { id: 3, name: 'Acme', applicationCount: 0, avoidedAt: null as string | null },
  jobRole: { name: 'Developer' },
  seniority: null,
  employmentType: null,
  schedule: null,
  workMode: null,
  description: null,
  url: 'https://example.com/job',
  postedOn: '2026-10-01',
  deadlineType: 'UNSPECIFIED',
  deadlineOn: null,
  dueOn: '2026-10-31',
  postingLanguage: null,
  favoritedAt: null,
  analyzedAt: null,
  archivedAt: null,
  status: 'SAVED',
  statusHistory: [],
  interviews: [],
  documents: [],
  locations: [],
  languages: [],
  skills: [
    { skill: { name: 'Vue' }, level: 4, minYears: null, isRequired: true },
    { skill: { name: 'Docker' }, level: 2, minYears: null, isRequired: false }
  ],
  contacts: [] as { contact: Record<string, unknown> }[]
}

const mountPage = async (overrides: Partial<typeof listing> = {}) => {
  registerEndpoint('/graphql', {
    method: 'POST',
    handler: () => ({ data: { listingById: { ...listing, ...overrides } } })
  })
  const wrapper = await mountSuspended(ListingPage, {
    route: '/listings/5',
    attachTo: document.body
  })
  await flushPromises()
  await vi.waitFor(() => expect(wrapper.find('[data-testid="listing-header"]').exists()).toBe(true))
  return wrapper
}

describe('Listing page', () => {
  it('shows the title and status badges in a header above the cards', async () => {
    const wrapper = await mountPage()
    const header = wrapper.get('[data-testid="listing-header"]')

    expect(header.text()).toContain('Frontend Developer')
    expect(header.get('[data-testid="listing-status"]').text()).toBe('Saved')
    expect(header.get('[data-testid="listing-analyzed"]').text()).toBe('To analyze')
    expect(header.find('[data-testid="company-avoided"]').exists()).toBe(false)
    expect(header.get('[data-testid="listing-company"]').attributes('href')).toBe('/companies/3')
    wrapper.unmount()
  })

  it('badges a listing whose company is avoided', async () => {
    const wrapper = await mountPage({
      company: { ...listing.company, avoidedAt: '2026-10-07T10:00:00Z' }
    })

    expect(wrapper.get('[data-testid="company-avoided"]').text()).toBe('Avoided company')
    wrapper.unmount()
  })

  it('offers Mark analyzed and Archive in the More menu for an unanalyzed listing', async () => {
    const wrapper = await mountPage()

    await wrapper.get('[data-testid="listing-more"]').trigger('click')
    await flushPromises()

    const menu = document.body.textContent
    expect(menu).toContain('Mark analyzed')
    expect(menu).toContain('Archive')
    wrapper.unmount()
  })

  it('shows an applied listing whose documents were never sent', async () => {
    const wrapper = await mountPage({
      status: 'APPLIED',
      documents: [
        { id: 1, kind: 'CV', fileName: 'cv.pdf', sentAt: null }
      ] as unknown as typeof listing.documents
    })

    expect(wrapper.get('[data-testid="listing-documents"]').text()).toContain('cv.pdf')
    expect(wrapper.get('[data-testid="listing-documents"]').text()).not.toContain('Sent')
    wrapper.unmount()
  })

  it('groups skills into Required and Nice to have', async () => {
    const wrapper = await mountPage()
    const text = wrapper.text()

    expect(text.indexOf('Required')).toBeLessThan(text.indexOf('Vue'))
    expect(text.indexOf('Vue')).toBeLessThan(text.indexOf('Nice to have'))
    expect(text.indexOf('Nice to have')).toBeLessThan(text.indexOf('Docker'))
    wrapper.unmount()
  })

  it('shows the linked contacts', async () => {
    const wrapper = await mountPage({
      contacts: [
        {
          contact: {
            id: 5,
            name: 'Kari Nordmann',
            title: 'Recruiter',
            email: null,
            phone: '+47 123',
            url: null,
            notes: null
          }
        }
      ]
    })

    const contact = wrapper.get('[data-testid="contact"]')
    expect(contact.text()).toContain('Kari Nordmann')
    expect(contact.find('a[href="tel:+47 123"]').exists()).toBe(true)
    expect(contact.find('[data-testid="contact-edit"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

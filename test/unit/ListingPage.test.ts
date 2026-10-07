import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import ListingPage from '~/pages/listings/[id]/index.vue'

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))

const listing = {
  id: 5,
  title: 'Frontend Developer',
  company: { name: 'Acme', applicationCount: 0 },
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
  ]
}

const mountPage = async () => {
  registerEndpoint('/graphql', {
    method: 'POST',
    handler: () => ({ data: { listingById: listing } })
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

  it('groups skills into Required and Nice to have', async () => {
    const wrapper = await mountPage()
    const text = wrapper.text()

    expect(text.indexOf('Required')).toBeLessThan(text.indexOf('Vue'))
    expect(text.indexOf('Vue')).toBeLessThan(text.indexOf('Nice to have'))
    expect(text.indexOf('Nice to have')).toBeLessThan(text.indexOf('Docker'))
    wrapper.unmount()
  })
})

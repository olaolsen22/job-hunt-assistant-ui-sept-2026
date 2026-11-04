import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import AddPage from '~/pages/listings/add.vue'

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))

describe('Open application to a person', () => {
  it('starts an open invitation at their company with them as the first contact', async () => {
    const ids: unknown[] = []
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const { query, variables } = await readBody(event)
        if (!query.includes('ContactForListing')) return { data: {} }
        ids.push(variables.id)
        return {
          data: {
            contactById: {
              name: 'Kari Nordmann',
              title: 'Recruiter',
              email: 'kari@acme.no',
              phone: null,
              url: null,
              company: { name: 'Acme' }
            }
          }
        }
      }
    })

    const wrapper = await mountSuspended(AddPage, {
      route: '/listings/add?contact=5',
      attachTo: document.body
    })
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="open-application-notice"]').exists()).toBe(true)
    )
    await flushPromises()

    expect(ids).toEqual([5])
    expect(wrapper.get('[data-testid="open-application-notice"]').text()).toContain(
      'The cover letter will be addressed to Kari Nordmann.'
    )
    expect(wrapper.vm.state).toMatchObject({
      kind: 'OPEN_INVITATION',
      companyName: 'Acme',
      contacts: [
        { name: 'Kari Nordmann', title: 'Recruiter', email: 'kari@acme.no', phone: null, url: null }
      ]
    })
    expect(wrapper.get('[data-testid="add-listing-back"]').attributes('href')).toBe('/contacts/5')
    wrapper.unmount()
  })
})

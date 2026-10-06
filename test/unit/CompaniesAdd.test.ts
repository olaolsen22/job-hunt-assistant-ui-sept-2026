import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import AddPage from '~/pages/companies/add.vue'

describe('Add companies', () => {
  it('previews pasted companies, then saves them and reports the one that existed', async () => {
    let sent: unknown
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const { query, variables } = await readBody(event)
        if (query.includes('CompanyParsePrompt')) return { data: { prompt: { instructions: 'x' } } }
        sent = variables.companies
        return {
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
      }
    })

    const wrapper = await mountSuspended(AddPage)
    await flushPromises()

    const reply = JSON.stringify([
      {
        name: 'Bekk',
        industryName: 'Consulting',
        locations: [{ city: 'Oslo', countryCode: 'NO' }]
      },
      { name: 'Vipps', industryName: null, locations: [] }
    ])
    await wrapper.get('[data-testid="companies-add-json"]').setValue(`\`\`\`json\n${reply}\n\`\`\``)
    await wrapper.get('[data-testid="companies-add-parse"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-testid="companies-add-row"]')).toHaveLength(2)

    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() =>
      expect(wrapper.findAll('[data-testid="companies-add-row-saved"]')).toHaveLength(1)
    )
    expect(sent).toEqual([
      {
        name: 'Bekk',
        industryName: 'Consulting',
        locations: [{ city: 'Oslo', countryCode: 'NO' }]
      },
      { name: 'Vipps', industryName: null, locations: [] }
    ])
    expect(wrapper.get('[data-testid="companies-add-row-existing"]').text()).toContain(
      'Already existed'
    )
  })
})

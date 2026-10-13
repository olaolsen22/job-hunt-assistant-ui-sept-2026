import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import AddPage from '~/pages/companies/add.vue'
import { llmModels } from '../fixtures/llmModels'

describe('Add companies', () => {
  it('previews pasted companies, then saves them and reports the one that existed', async () => {
    let sent: unknown
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const { query, variables } = await readBody(event)
        if (query.includes('CompanyParsePrompt')) return { data: { prompt: { instructions: 'x' } } }
        if (query.includes('query LlmModels')) return { data: { llmModels: llmModels() } }
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

  it('asks before another built-in parse after an interrupted one', async () => {
    const requestIds: string[] = []
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const { query, variables } = await readBody(event)
        if (query.includes('CompanyParsePrompt')) return { data: { prompt: { instructions: 'x' } } }
        if (query.includes('query LlmModels')) return { data: { llmModels: llmModels() } }
        requestIds.push(variables.requestId)
        const parseListing =
          requestIds.length === 1
            ? {
                parseJob: null,
                errors: [
                  {
                    __typename: 'AiSafetyError',
                    message: 'The run was interrupted.',
                    code: 'operation-interrupted'
                  }
                ]
              }
            : {
                parseJob: { status: 'SUCCEEDED', result: '[{"name":"Bekk"}]', error: null },
                errors: null
              }
        return { data: { parseListing } }
      }
    })

    const wrapper = await mountSuspended(AddPage)
    await flushPromises()
    await wrapper.get('[data-testid="companies-add-builtin"]').trigger('click')
    await wrapper.get('[data-testid="companies-add-ad"]').setValue('Bekk')
    await wrapper.get('[data-testid="companies-add-builtin-run"]').trigger('click')

    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="ai-retry-confirm"]').text()).toContain('interrupted')
    )
    expect(
      wrapper.get('[data-testid="companies-add-builtin-run"]').attributes('disabled')
    ).toBeDefined()

    await wrapper.get('[data-testid="ai-retry-confirm-run"]').trigger('click')
    await vi.waitFor(() =>
      expect(wrapper.findAll('[data-testid="companies-add-row"]')).toHaveLength(1)
    )
    expect(requestIds).toHaveLength(2)
    expect(requestIds[1]).not.toBe(requestIds[0])
  })
})

import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import AddPage from '~/pages/companies/add.vue'
import { llmModels } from '../fixtures/llmModels'

// The parse modal is teleported to the body, so its controls are found there.
const inBody = <T extends HTMLElement>(testid: string) =>
  document.body.querySelector<T>(`[data-testid="${testid}"]`)

const click = async (testid: string) => {
  inBody(testid)!.click()
  await flushPromises()
}

const type = async (testid: string, value: string) => {
  const field = inBody<HTMLTextAreaElement>(testid)!
  field.value = value
  field.dispatchEvent(new Event('input'))
  await flushPromises()
}

const mountPage = async () => {
  const wrapper = await mountSuspended(AddPage, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('Add companies', () => {
  it('puts Back to the remembered companies view in the navbar', async () => {
    // Mounting at a route runs the global auth middleware.
    registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const { query } = await readBody(event)
        if (query.includes('query LlmModels')) return { data: { llmModels: llmModels() } }
        return { data: { llmUsageToday: null } }
      }
    })
    useCompaniesView().value = '/companies?kind=CONSULTANCY'
    const wrapper = await mountSuspended(AddPage, { route: '/companies/add' })
    await flushPromises()
    expect(useBackLinkState().value).toEqual({
      path: '/companies/add',
      to: '/companies?kind=CONSULTANCY',
      label: 'Companies'
    })
    useCompaniesView().value = '/companies'
    wrapper.unmount()
  })

  it('previews pasted companies with their research, then reports created, enriched and unchanged', async () => {
    let sent: unknown
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const { query, variables } = await readBody(event)
        if (query.includes('CompanyParsePrompt')) return { data: { prompt: { instructions: 'x' } } }
        if (query.includes('query LlmModels')) return { data: { llmModels: llmModels() } }
        if (query.includes('LlmUsage')) return { data: { llmUsageToday: null } }
        sent = variables.companies
        return {
          data: {
            createCompanies: {
              results: [
                { created: true, filled: false, company: { id: 1, name: 'Bekk' } },
                { created: false, filled: true, company: { id: 2, name: 'Vipps' } },
                { created: false, filled: false, company: { id: 3, name: 'Kahoot' } }
              ],
              errors: null
            }
          }
        }
      }
    })
    document.cookie = 'ai-method=own; path=/'

    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="companies-add-empty"]').exists()).toBe(true)
    await wrapper.get('[data-testid="companies-add-paste"]').trigger('click')
    await flushPromises()

    const reply = JSON.stringify([
      {
        name: 'Bekk',
        industryName: 'Consulting',
        locations: [{ city: 'Oslo', countryCode: 'NO' }],
        kind: 'CONSULTANCY',
        sizeBand: 'tiny',
        websiteUrl: 'https://bekk.no',
        skills: ['Kotlin', 'kotlin', 'React'],
        contacts: [{ name: 'Kari Nordmann', title: 'Recruiter' }]
      },
      { name: 'Vipps', industryName: null, locations: [] },
      { name: 'Kahoot', locations: [] }
    ])
    await type('companies-parse-json', `\`\`\`json\n${reply}\n\`\`\``)
    await click('companies-parse-apply')

    const rows = wrapper.findAll('[data-testid="companies-add-row"]')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.get('[data-testid="companies-add-row-research"]').text()).toBe(
      'Research included: Consultancy · 2 skills · 1 contact · website'
    )
    // An unknown size would fail the whole request, so it is dropped and said so.
    expect(rows[0]!.get('[data-testid="companies-add-row-ignored"]').text()).toBe(
      'Ignored: size “tiny”'
    )
    expect(rows[1]!.find('[data-testid="companies-add-row-research"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="companies-add-researched"]').text()).toContain(
      'Researched 3 companies'
    )

    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() =>
      expect(wrapper.findAll('[data-testid="companies-add-row-saved"]')).toHaveLength(1)
    )
    expect(sent).toMatchObject([
      {
        name: 'Bekk',
        industryName: 'Consulting',
        locations: [{ city: 'Oslo', countryCode: 'NO' }],
        kind: 'CONSULTANCY',
        sizeBand: null,
        websiteUrl: 'https://bekk.no',
        skills: ['Kotlin', 'React'],
        contacts: [
          { name: 'Kari Nordmann', title: 'Recruiter', email: null, phone: null, url: null }
        ]
      },
      { name: 'Vipps', industryName: null, locations: [], skills: [] },
      { name: 'Kahoot', industryName: null, locations: [] }
    ])
    expect(wrapper.get('[data-testid="companies-add-row-saved"]').text()).toContain(
      'Created with research'
    )
    expect(wrapper.get('[data-testid="companies-add-row-enriched"]').text()).toContain(
      'Already existed, filled in missing details'
    )
    expect(wrapper.get('[data-testid="companies-add-row-existing"]').text()).toContain(
      'Already existed, nothing new to add'
    )
    expect(wrapper.get('[data-testid="companies-add-paste-summary"]').text()).toContain(
      '1 created, 1 enriched, 1 unchanged.'
    )
    wrapper.unmount()
    document.cookie = 'ai-method=; Max-Age=0; path=/'
  })

  it('keeps the modal open when the reply has no companies', async () => {
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const { query } = await readBody(event)
        if (query.includes('CompanyParsePrompt')) return { data: { prompt: { instructions: 'x' } } }
        if (query.includes('query LlmModels')) return { data: { llmModels: llmModels() } }
        return { data: { llmUsageToday: null } }
      }
    })
    document.cookie = 'ai-method=own; path=/'

    const wrapper = await mountPage()
    await wrapper.get('[data-testid="companies-add-paste"]').trigger('click')
    await flushPromises()
    await type('companies-parse-json', '[]')
    await click('companies-parse-apply')

    expect(document.body.textContent).toContain('No companies found in that reply.')
    expect(inBody('companies-parse-json')).not.toBeNull()
    expect(wrapper.findAll('[data-testid="companies-add-row"]')).toHaveLength(0)
    wrapper.unmount()
    document.cookie = 'ai-method=; Max-Age=0; path=/'
  })

  it('asks before another built-in parse after an interrupted one', async () => {
    const requestIds: string[] = []
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const { query, variables } = await readBody(event)
        if (query.includes('CompanyParsePrompt')) return { data: { prompt: { instructions: 'x' } } }
        if (query.includes('query LlmModels')) return { data: { llmModels: llmModels() } }
        if (!query.includes('mutation ParseListing')) return { data: { llmUsageToday: null } }
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

    const wrapper = await mountPage()
    await wrapper.get('[data-testid="companies-add-paste"]').trigger('click')
    await flushPromises()
    await type('companies-parse-text', 'Bekk')
    await click('companies-parse-run')

    await vi.waitFor(() => expect(inBody('ai-retry-confirm')?.textContent).toContain('interrupted'))
    expect(inBody<HTMLButtonElement>('companies-parse-run')!.disabled).toBe(true)

    await click('ai-retry-confirm-run')
    await vi.waitFor(() =>
      expect(wrapper.findAll('[data-testid="companies-add-row"]')).toHaveLength(1)
    )
    expect(requestIds).toHaveLength(2)
    expect(requestIds[1]).not.toBe(requestIds[0])
    wrapper.unmount()
  })

  it('opens the modal with the names picked on the list and marks their rows as existing', async () => {
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        const { query } = await readBody(event)
        if (query.includes('CompanyParsePrompt')) return { data: { prompt: { instructions: 'x' } } }
        if (query.includes('query LlmModels')) return { data: { llmModels: llmModels() } }
        return { data: { llmUsageToday: null } }
      }
    })
    document.cookie = 'ai-method=own; path=/'
    useState<string[]>('companiesResearchNames').value = ['Bekk', 'Vipps']

    const wrapper = await mountPage()
    await vi.waitFor(() =>
      expect(inBody<HTMLTextAreaElement>('companies-parse-text')?.value).toBe('Bekk\nVipps')
    )
    // Worded for adding a list, unlike the edit page's single company.
    expect(document.body.textContent).toContain('Research companies')
    expect(inBody('companies-parse-apply')!.textContent).toContain('Add to list')
    // Handed over once: a later visit starts empty.
    expect(useState<string[]>('companiesResearchNames').value).toEqual([])

    await type('companies-parse-json', '[{"name":"Bekk"},{"name":"Kahoot"}]')
    await click('companies-parse-apply')

    const rows = wrapper.findAll('[data-testid="companies-add-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Existing company, will fill empty fields only')
    expect(rows[1]!.text()).not.toContain('Existing company')
    wrapper.unmount()
    document.cookie = 'ai-method=; Max-Age=0; path=/'
  })
})

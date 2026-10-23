import { describe, expect, it, vi } from 'vitest'
import { readBody } from 'h3'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import EditPage from '~/pages/companies/[id]/edit.vue'
import { llmModels } from '../fixtures/llmModels'

const { navigateTo } = vi.hoisted(() => ({ navigateTo: vi.fn() }))
mockNuxtImport('navigateTo', () => navigateTo)
registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))

const company = {
  id: 3,
  name: 'Acme',
  industry: { name: 'Consulting' },
  locations: [{ location: { city: 'Oslo', countryCode: 'NO' } }],
  orgNumber: '923609016',
  websiteUrl: 'https://acme.no',
  careersUrl: null,
  linkedInUrl: null,
  kind: 'CONSULTANCY',
  sizeBand: 'SMALL',
  foundedYear: 2001,
  description: 'Builds things.',
  workMode: 'HYBRID',
  workingLanguage: null,
  skills: [{ skill: { name: 'Vue' } }]
}

type Errors = { __typename: string; message: string }[] | null

// The parse modal is teleported to the body, so its controls are found there.
const inBody = <T extends HTMLElement>(testid: string) =>
  document.body.querySelector<T>(`[data-testid="${testid}"]`)

const mountEdit = async (
  errors: Errors,
  detailErrors: Errors = null,
  route = '/companies/3/edit',
  overrides: Partial<typeof company> = {}
) => {
  const inputs: unknown[] = []
  registerEndpoint('/graphql', {
    method: 'POST',
    handler: async (event) => {
      const { query, variables } = await readBody(event)
      if (query.includes('CompanyParsePrompt')) return { data: { prompt: { instructions: 'x' } } }
      if (query.includes('query LlmModels')) return { data: { llmModels: llmModels() } }
      if (query.includes('LlmUsage')) return { data: { llmUsageToday: null } }
      if (query.includes('updateCompany')) {
        inputs.push({ input: variables.input, details: variables.details })
        return {
          data: {
            updateCompany: { company: errors ? null : { id: 3 }, errors },
            updateCompanyDetails: { company: detailErrors ? null : { id: 3 }, errors: detailErrors }
          }
        }
      }
      return { data: { companies: { nodes: [{ ...company, ...overrides }] } } }
    }
  })
  const wrapper = await mountSuspended(EditPage, {
    route,
    attachTo: document.body
  })
  await flushPromises()
  // Filled once the company arrives.
  await vi.waitFor(() =>
    expect(
      wrapper.get<HTMLInputElement>('input[data-testid="edit-company-name"]').element.value
    ).toBe('Acme')
  )
  return { wrapper, inputs }
}

describe('Editing a company', () => {
  it('sends the full company with its research unchanged and replaces the form in history', async () => {
    navigateTo.mockClear()
    const { wrapper, inputs } = await mountEdit(null)

    await wrapper.get('[data-testid="edit-company-form"]').trigger('submit')

    await vi.waitFor(() =>
      expect(navigateTo).toHaveBeenCalledWith('/companies/3', { replace: true })
    )
    expect(inputs).toEqual([
      {
        input: {
          id: 3,
          name: 'Acme',
          industryName: 'Consulting',
          locations: [{ countryCode: 'NO', city: 'Oslo' }]
        },
        // A full replace, so every research field is resent, the unset ones as null.
        details: {
          id: 3,
          details: {
            orgNumber: '923609016',
            websiteUrl: 'https://acme.no',
            careersUrl: null,
            linkedInUrl: null,
            kind: 'CONSULTANCY',
            sizeBand: 'SMALL',
            foundedYear: 2001,
            description: 'Builds things.',
            workMode: 'HYBRID',
            workingLanguage: null,
            skills: ['Vue']
          }
        }
      }
    ])
    wrapper.unmount()
  })

  it('shows the API error and stays on the form', async () => {
    navigateTo.mockClear()
    const { wrapper } = await mountEdit([
      { __typename: 'InvalidCompanyError', message: 'Name is required.' }
    ])

    await wrapper.get('[data-testid="edit-company-form"]').trigger('submit')

    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="edit-company-error"]').text()).toBe(
        'Research was saved. Name, industry and locations not saved: Name is required.'
      )
    )
    expect(navigateTo).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('says the basics were saved when only the research was rejected', async () => {
    navigateTo.mockClear()
    const { wrapper } = await mountEdit(null, [
      { __typename: 'InvalidCompanyError', message: 'Org.nr is used by another company.' }
    ])

    await wrapper.get('[data-testid="edit-company-form"]').trigger('submit')

    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="edit-company-error"]').text()).toBe(
        'Name, industry and locations were saved. Research not saved: Org.nr is used by another company.'
      )
    )
    expect(navigateTo).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('flags an invalid org.nr on the field without saving', async () => {
    const { wrapper, inputs } = await mountEdit(null)
    await wrapper.get('input[data-testid="edit-company-org-number"]').setValue('123456789')

    await wrapper.get('[data-testid="edit-company-form"]').trigger('submit')

    await vi.waitFor(() => expect(wrapper.text()).toContain('Enter a valid 9-digit org.nr'))
    expect(inputs).toEqual([])
    wrapper.unmount()
  })

  it('opens the single-company research modal with the name when linked with ?analyze', async () => {
    const { wrapper } = await mountEdit(null, null, '/companies/3/edit?analyze')

    await vi.waitFor(() =>
      expect(inBody<HTMLInputElement>('companies-parse-text')?.value).toBe('Acme')
    )
    // Worded for this one company, not the add page's list.
    expect(document.body.textContent).toContain('Research company')
    expect(document.body.textContent).not.toContain('Add companies')
    expect(inBody('companies-parse-run')!.textContent).toContain('Research company')
    wrapper.unmount()
  })

  const pasteReply = async (
    wrapper: Awaited<ReturnType<typeof mountEdit>>['wrapper'],
    rows: object[]
  ) => {
    await wrapper.get('[data-testid="edit-company-research-ai"]').trigger('click')
    await flushPromises()
    const json = inBody<HTMLTextAreaElement>('companies-parse-json')!
    json.value = JSON.stringify(rows)
    json.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(inBody('companies-parse-apply')!.textContent).toContain('Fill form')
    inBody('companies-parse-apply')!.click()
    await flushPromises()
  }

  it('fills only the empty fields from this company’s row and sends the merged form on save', async () => {
    document.cookie = 'ai-method=own; path=/'
    const { wrapper, inputs } = await mountEdit(null)
    expect(wrapper.get('[data-testid="edit-company-research-ai"]').text()).toBe(
      'Re-research company'
    )

    // Another company first: the row for Acme is the one used.
    await pasteReply(wrapper, [
      { name: 'Vipps', workMode: 'REMOTE', websiteUrl: 'https://vipps.no' },
      {
        name: 'acme',
        kind: 'PRODUCT',
        workingLanguage: 'ENGLISH',
        careersUrl: 'https://acme.no/jobs',
        sizeBand: 'tiny',
        skills: ['Go']
      }
    ])

    const analysis = wrapper.get('[data-testid="edit-company-analysis"]').text()
    expect(analysis).toContain('Filled from the research')
    expect(analysis).toContain('Nothing is saved yet.')
    expect(analysis).toContain('Filled: careers page, working language.')
    expect(analysis).toContain('Kept: type, skills.')
    expect(analysis).toContain('Ignored: size “tiny”.')

    await wrapper.get('[data-testid="edit-company-form"]').trigger('submit')
    await vi.waitFor(() => expect(inputs).toHaveLength(1))
    expect((inputs[0] as { details: { details: unknown } }).details.details).toMatchObject({
      kind: 'CONSULTANCY',
      workMode: 'HYBRID',
      websiteUrl: 'https://acme.no',
      workingLanguage: 'ENGLISH',
      careersUrl: 'https://acme.no/jobs',
      skills: ['Vue']
    })
    wrapper.unmount()
    document.cookie = 'ai-method=; Max-Age=0; path=/'
  })

  it('keeps the modal open when the reply is about other companies only', async () => {
    document.cookie = 'ai-method=own; path=/'
    const { wrapper } = await mountEdit(null)

    await pasteReply(wrapper, [{ name: 'Vipps' }, { name: 'Bekk' }])

    expect(document.body.textContent).toContain('The reply doesn’t include Acme.')
    expect(wrapper.find('[data-testid="edit-company-analysis"]').exists()).toBe(false)
    wrapper.unmount()
    document.cookie = 'ai-method=; Max-Age=0; path=/'
  })

  it('fills empty industry and locations from the reply, and keeps saved ones', async () => {
    document.cookie = 'ai-method=own; path=/'
    const { wrapper, inputs } = await mountEdit(null, null, '/companies/3/edit', {
      industry: null as unknown as typeof company.industry,
      locations: []
    })

    await pasteReply(wrapper, [
      {
        name: 'Acme',
        industryName: 'Software',
        locations: [
          { city: 'Bergen', countryCode: 'NO' },
          { city: 'Nowhere', countryCode: 'XX' }
        ]
      }
    ])

    const analysis = wrapper.get('[data-testid="edit-company-analysis"]').text()
    expect(analysis).toContain('Filled: industry, locations.')
    expect(analysis).toContain('Ignored: location “Nowhere, XX”.')

    await wrapper.get('[data-testid="edit-company-form"]').trigger('submit')
    await vi.waitFor(() => expect(inputs).toHaveLength(1))
    expect((inputs[0] as { input: unknown }).input).toMatchObject({
      industryName: 'Software',
      locations: [{ countryCode: 'NO', city: 'Bergen' }]
    })
    wrapper.unmount()
    document.cookie = 'ai-method=; Max-Age=0; path=/'
  })

  it('keeps saved locations when the reply has others', async () => {
    document.cookie = 'ai-method=own; path=/'
    const { wrapper } = await mountEdit(null)

    await pasteReply(wrapper, [
      { name: 'Acme', industryName: 'Software', locations: [{ city: 'Bergen', countryCode: 'NO' }] }
    ])

    expect(wrapper.get('[data-testid="edit-company-analysis"]').text()).toContain(
      'Kept: industry, locations.'
    )
    wrapper.unmount()
    document.cookie = 'ai-method=; Max-Age=0; path=/'
  })
})

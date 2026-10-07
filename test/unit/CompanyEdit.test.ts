import { describe, expect, it, vi } from 'vitest'
import { readBody } from 'h3'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import EditPage from '~/pages/companies/[id]/edit.vue'

const { navigateTo } = vi.hoisted(() => ({ navigateTo: vi.fn() }))
mockNuxtImport('navigateTo', () => navigateTo)
registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))

const company = {
  id: 3,
  name: 'Acme',
  industry: { name: 'Consulting' },
  locations: [{ location: { city: 'Oslo', countryCode: 'NO' } }]
}

const mountEdit = async (errors: { __typename: string; message: string }[] | null) => {
  const inputs: unknown[] = []
  registerEndpoint('/graphql', {
    method: 'POST',
    handler: async (event) => {
      const { query, variables } = await readBody(event)
      if (query.includes('updateCompany')) {
        inputs.push(variables.input)
        return { data: { updateCompany: { company: errors ? null : { id: 3 }, errors } } }
      }
      return { data: { companies: { nodes: [company] } } }
    }
  })
  const wrapper = await mountSuspended(EditPage, {
    route: '/companies/3/edit',
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
  it('sends the full company and replaces the form in history', async () => {
    navigateTo.mockClear()
    const { wrapper, inputs } = await mountEdit(null)

    await wrapper.get('[data-testid="edit-company-form"]').trigger('submit')

    await vi.waitFor(() =>
      expect(navigateTo).toHaveBeenCalledWith('/companies/3', { replace: true })
    )
    expect(inputs).toEqual([
      {
        id: 3,
        name: 'Acme',
        industryName: 'Consulting',
        locations: [{ countryCode: 'NO', city: 'Oslo' }]
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
      expect(wrapper.find('[data-testid="edit-company-error"]').text()).toBe('Name is required.')
    )
    expect(navigateTo).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

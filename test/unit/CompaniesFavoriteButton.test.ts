import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import FavoriteButton from '~/components/companies/FavoriteButton.vue'

const respond = (payload: unknown, inputs: unknown[] = []) =>
  registerEndpoint('/graphql', {
    method: 'POST',
    handler: async (event) => {
      const { variables } = await readBody(event)
      inputs.push(variables.input)
      return { data: { setCompanyFavorite: payload } }
    }
  })

describe('Company favorite button', () => {
  it('favorites a company and keeps the star on', async () => {
    const inputs: unknown[] = []
    respond({ company: { id: 7, favoritedAt: '2026-10-06T10:00:00Z' }, errors: null }, inputs)
    const wrapper = await mountSuspended(FavoriteButton, { props: { id: 7, favoritedAt: null } })

    await wrapper.get('[data-testid="company-favorite"]').trigger('click')

    await vi.waitFor(() => expect(inputs).toEqual([{ id: 7, isFavorite: true }]))
    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="company-favorite"]').attributes('aria-pressed')).toBe(
        'true'
      )
    )
  })

  it('unfavorites a favorited company', async () => {
    const inputs: unknown[] = []
    respond({ company: { id: 7, favoritedAt: null }, errors: null }, inputs)
    const wrapper = await mountSuspended(FavoriteButton, {
      props: { id: 7, favoritedAt: '2026-10-06T10:00:00Z' }
    })

    await wrapper.get('[data-testid="company-favorite"]').trigger('click')

    await vi.waitFor(() => expect(inputs).toEqual([{ id: 7, isFavorite: false }]))
    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="company-favorite"]').attributes('aria-pressed')).toBe(
        'false'
      )
    )
  })

  it('rolls the star back when the API returns an error', async () => {
    respond({
      company: null,
      errors: [{ __typename: 'CompanyNotFoundError', message: 'Company not found' }]
    })
    const wrapper = await mountSuspended(FavoriteButton, { props: { id: 7, favoritedAt: null } })

    await wrapper.get('[data-testid="company-favorite"]').trigger('click')

    await vi.waitFor(() => expect(wrapper.get('button').attributes('disabled')).toBeUndefined())
    expect(wrapper.get('[data-testid="company-favorite"]').attributes('aria-pressed')).toBe('false')
  })
})

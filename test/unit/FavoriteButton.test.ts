import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import FavoriteButton from '~/components/app/FavoriteButton.vue'

const respond = (payload: unknown, inputs: unknown[] = [], field = 'setCompanyFavorite') =>
  registerEndpoint('/graphql', {
    method: 'POST',
    handler: async (event) => {
      const { query, variables } = await readBody(event)
      inputs.push({ field: query.match(/set\w+Favorite/)?.[0], ...variables.input })
      return { data: { [field]: payload } }
    }
  })

describe('Favorite button', () => {
  it('favorites a company and keeps the star on', async () => {
    const inputs: unknown[] = []
    respond({ company: { id: 7, favoritedAt: '2026-10-06T10:00:00Z' }, errors: null }, inputs)
    const wrapper = await mountSuspended(FavoriteButton, {
      props: { target: 'company', id: 7, favoritedAt: null }
    })

    await wrapper.get('[data-testid="company-favorite"]').trigger('click')

    await vi.waitFor(() =>
      expect(inputs).toEqual([{ field: 'setCompanyFavorite', id: 7, isFavorite: true }])
    )
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
      props: { target: 'company', id: 7, favoritedAt: '2026-10-06T10:00:00Z' }
    })

    await wrapper.get('[data-testid="company-favorite"]').trigger('click')

    await vi.waitFor(() =>
      expect(inputs).toEqual([{ field: 'setCompanyFavorite', id: 7, isFavorite: false }])
    )
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
    const wrapper = await mountSuspended(FavoriteButton, {
      props: { target: 'company', id: 7, favoritedAt: null }
    })

    await wrapper.get('[data-testid="company-favorite"]').trigger('click')

    await vi.waitFor(() => expect(wrapper.get('button').attributes('disabled')).toBeUndefined())
    expect(wrapper.get('[data-testid="company-favorite"]').attributes('aria-pressed')).toBe('false')
  })

  it('favorites a listing through the listing mutation', async () => {
    const inputs: unknown[] = []
    respond(
      { listing: { id: 3, favoritedAt: '2026-10-06T10:00:00Z' }, errors: null },
      inputs,
      'setListingFavorite'
    )
    const wrapper = await mountSuspended(FavoriteButton, {
      props: { target: 'listing', id: 3, favoritedAt: null }
    })

    await wrapper.get('[data-testid="listing-favorite"]').trigger('click')

    await vi.waitFor(() =>
      expect(inputs).toEqual([{ field: 'setListingFavorite', id: 3, isFavorite: true }])
    )
    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="listing-favorite"]').attributes('aria-pressed')).toBe(
        'true'
      )
    )
  })

  it('follows the prop when the list swaps another listing under it', async () => {
    const wrapper = await mountSuspended(FavoriteButton, {
      props: { target: 'listing', id: 1, favoritedAt: null }
    })
    const star = () => wrapper.get('[data-testid="listing-favorite"]')
    expect(star().attributes('aria-pressed')).toBe('false')

    await wrapper.setProps({ id: 2, favoritedAt: '2026-10-06T10:00:00Z' })
    expect(star().attributes('aria-pressed')).toBe('true')

    await wrapper.setProps({ id: 3, favoritedAt: null })
    expect(star().attributes('aria-pressed')).toBe('false')
  })
})

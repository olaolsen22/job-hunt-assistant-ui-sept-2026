import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import ShortlistButton from '~/components/listings/ShortlistButton.vue'

const respond = (payload: unknown, inputs: unknown[] = [], field = 'setListingShortlisted') =>
  registerEndpoint('/graphql', {
    method: 'POST',
    handler: async (event) => {
      const { query, variables } = await readBody(event)
      inputs.push({ field: query.match(/set\w+Shortlisted/)?.[0], ...variables.input })
      return { data: { [field]: payload } }
    }
  })

describe('Shortlist button', () => {
  it('shortlists a listing and keeps the bookmark on', async () => {
    const inputs: unknown[] = []
    respond({ listing: { id: 7, shortlistedAt: '2026-10-06T10:00:00Z' }, errors: null }, inputs)
    const wrapper = await mountSuspended(ShortlistButton, {
      props: { id: 7, shortlistedAt: null }
    })

    await wrapper.get('[data-testid="listing-shortlist"]').trigger('click')

    await vi.waitFor(() =>
      expect(inputs).toEqual([{ field: 'setListingShortlisted', id: 7, isShortlisted: true }])
    )
    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="listing-shortlist"]').attributes('aria-pressed')).toBe(
        'true'
      )
    )
  })

  it('removes a listing from the shortlist', async () => {
    const inputs: unknown[] = []
    respond({ listing: { id: 7, shortlistedAt: null }, errors: null }, inputs)
    const wrapper = await mountSuspended(ShortlistButton, {
      props: { id: 7, shortlistedAt: '2026-10-06T10:00:00Z' }
    })

    await wrapper.get('[data-testid="listing-shortlist"]').trigger('click')

    await vi.waitFor(() =>
      expect(inputs).toEqual([{ field: 'setListingShortlisted', id: 7, isShortlisted: false }])
    )
    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="listing-shortlist"]').attributes('aria-pressed')).toBe(
        'false'
      )
    )
  })

  it('rolls the bookmark back when the API returns an error', async () => {
    respond({
      listing: null,
      errors: [{ __typename: 'CompanyNotFoundError', message: 'Company not found' }]
    })
    const wrapper = await mountSuspended(ShortlistButton, {
      props: { id: 7, shortlistedAt: null }
    })

    await wrapper.get('[data-testid="listing-shortlist"]').trigger('click')

    await vi.waitFor(() => expect(wrapper.get('button').attributes('disabled')).toBeUndefined())
    expect(wrapper.get('[data-testid="listing-shortlist"]').attributes('aria-pressed')).toBe(
      'false'
    )
  })

  it('saves a bookmark through the shortlist mutation', async () => {
    const inputs: unknown[] = []
    respond(
      { listing: { id: 3, shortlistedAt: '2026-10-06T10:00:00Z' }, errors: null },
      inputs,
      'setListingShortlisted'
    )
    const wrapper = await mountSuspended(ShortlistButton, {
      props: { id: 3, shortlistedAt: null }
    })

    await wrapper.get('[data-testid="listing-shortlist"]').trigger('click')

    await vi.waitFor(() =>
      expect(inputs).toEqual([{ field: 'setListingShortlisted', id: 3, isShortlisted: true }])
    )
    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="listing-shortlist"]').attributes('aria-pressed')).toBe(
        'true'
      )
    )
  })

  it('follows the prop when the list swaps another listing under it', async () => {
    const wrapper = await mountSuspended(ShortlistButton, {
      props: { id: 1, shortlistedAt: null }
    })
    const star = () => wrapper.get('[data-testid="listing-shortlist"]')
    expect(star().attributes('aria-pressed')).toBe('false')

    await wrapper.setProps({ id: 2, shortlistedAt: '2026-10-06T10:00:00Z' })
    expect(star().attributes('aria-pressed')).toBe('true')

    await wrapper.setProps({ id: 3, shortlistedAt: null })
    expect(star().attributes('aria-pressed')).toBe('false')
  })
})

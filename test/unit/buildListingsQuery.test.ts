import { describe, expect, it } from 'vitest'
import { print } from '@0no-co/graphql.web'
import {
  buildListingsQuery,
  emptyFacets,
  parseListingsQuery,
  type ListingsFacets
} from '~/composables/useListingsList'

const build = (facets: Partial<ListingsFacets>) => {
  const { document, variables } = buildListingsQuery(null, { ...emptyFacets(), ...facets }, 'due')
  return { text: print(document), variables }
}

describe('buildListingsQuery', () => {
  it('leaves out facets with nothing selected', () => {
    const { text, variables } = build({})
    expect(text).not.toMatch(/\$(statuses|skills|locationIds|postingLanguages|languages)\b/)
    expect(text).not.toContain('favoritedAt: {neq')
    expect(Object.keys(variables).sort()).toEqual(['order', 'today'])
    expect(variables.order).toBeUndefined()
  })

  it('drops the expiry clause when statuses are picked', () => {
    const { text, variables } = build({ statuses: ['APPLIED'] })
    expect(text).toContain('status: {in: $statuses}')
    expect(text).not.toContain('$today')
    expect(variables).not.toHaveProperty('today')
    expect(variables.statuses).toEqual(['APPLIED'])
  })

  it('joins two facets under and', () => {
    const { text } = build({ favorites: true, skills: ['Vue'] })
    expect(text).toContain(
      'where: {and: [{or: [{deadlineType: {neq: DATE}}, {deadlineOn: {gte: $today}}]}, {favoritedAt: {neq: null}}, {skills: {some: {skill: {name: {in: $skills}}}}}]}'
    )
  })
})

describe('parseListingsQuery', () => {
  it('reads a preset, statuses and favorites from the URL', () => {
    expect(
      parseListingsQuery({ filter: 'closingSoon', status: 'OFFER,APPLIED', favorites: '1' })
    ).toEqual({ filter: 'closingSoon', statuses: ['OFFER', 'APPLIED'], favorites: true })
  })

  it('ignores unknown values', () => {
    expect(parseListingsQuery({ filter: 'nope', status: 'NOPE,SAVED', favorites: 'yes' })).toEqual({
      filter: null,
      statuses: ['SAVED'],
      favorites: false
    })
  })
})

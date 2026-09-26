import { describe, expect, it } from 'vitest'
import { useListingForm } from '~/composables/useListingForm'

const fillRequired = (state: ReturnType<typeof useListingForm>['state']) => {
  state.title = ' Frontend Developer '
  state.companyName = 'Acme'
  state.jobRoleName = 'Developer'
  state.url = 'https://example.com/job'
}

describe('useListingForm', () => {
  it('flags missing required fields and a non-http URL', () => {
    const { state, validate } = useListingForm()
    state.url = 'example.com'

    expect(validate(state).map((e) => e.name)).toEqual([
      'title',
      'companyName',
      'jobRoleName',
      'url'
    ])

    fillRequired(state)
    expect(validate(state)).toEqual([])
  })

  it('requires a deadline date only when the type is DATE', () => {
    const { state, validate } = useListingForm()
    fillRequired(state)
    state.deadlineType = 'DATE'

    expect(validate(state).map((e) => e.name)).toEqual(['deadlineOn'])
  })

  it('builds the API input with nulls for empty fields', () => {
    const { state, toInput } = useListingForm()
    fillRequired(state)
    state.deadlineType = 'ASAP'
    state.deadlineOn = '2026-10-01'
    state.skills = [{ name: 'Vue', level: 4, isRequired: true }]

    expect(toInput()).toMatchObject({
      title: 'Frontend Developer',
      description: null,
      seniority: null,
      deadlineOn: null,
      locations: [{ countryCode: 'NO', city: null }],
      skills: [{ name: 'Vue', level: 4, minYears: null, isRequired: true }]
    })
  })
})

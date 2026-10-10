import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import CompareModal from '~/components/listings/CompareModal.vue'
import type { ComparedListing } from '~/composables/listingCompareFields'

const listing = (id: number, title: string, url: string): ComparedListing => ({
  id,
  title,
  url,
  postedOn: '2026-10-01',
  deadlineType: 'ASAP',
  deadlineOn: null,
  status: 'SAVED',
  company: { name: 'Acme' },
  jobRole: { name: 'Frontend developer' },
  locations: [{ location: { city: 'Oslo', countryCode: 'NO' } }]
})

const fresh = listing(10, 'Frontend developer', 'https://jobs.example/1')
const sameUrl = listing(1, 'Frontend developer', 'https://jobs.example/1')
const otherUrl = listing(2, 'Senior frontend developer', 'https://jobs.example/2')

const body = () => document.body
const differing = () =>
  [...body().querySelectorAll('[data-testid="compare-row-differs"]')].map((r) => r.textContent)

let wrapper: VueWrapper | undefined
afterEach(() => wrapper?.unmount())

const mount = async (matches: ComparedListing[]) => {
  wrapper = await mountSuspended(CompareModal, {
    props: { open: true, listing: fresh, matches, matchId: matches[0]!.id },
    attachTo: document.body
  })
  await flushPromises()
  return wrapper
}

describe('ListingsCompareModal', () => {
  it('marks only the fields that differ and hides the selector for one match', async () => {
    await mount([otherUrl])

    // The modal is teleported to <body>, outside the wrapper.
    const rows = differing()
    expect(rows).toHaveLength(2)
    expect(rows[0]).toContain('Senior frontend developer')
    expect(rows[1]).toContain('https://jobs.example/2')
    expect(body().querySelector('[data-testid="compare-select"]')).toBeNull()
  })

  it('switches the existing side between several matches', async () => {
    const w = await mount([otherUrl, sameUrl])
    expect(body().querySelector('[data-testid="compare-select"]')).not.toBeNull()
    expect(differing()).toHaveLength(2)

    await w.setProps({ matchId: sameUrl.id })
    expect(differing()).toHaveLength(0)
  })

  it('emits keep and remove from the footer', async () => {
    const w = await mount([sameUrl])
    body().querySelector<HTMLElement>('[data-testid="compare-keep"]')!.click()
    body().querySelector<HTMLElement>('[data-testid="compare-remove"]')!.click()

    expect(w.emitted('keep')).toHaveLength(1)
    expect(w.emitted('remove')).toHaveLength(1)
  })
})

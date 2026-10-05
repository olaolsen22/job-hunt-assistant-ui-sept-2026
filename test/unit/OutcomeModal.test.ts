import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import OutcomeModal from '~/components/listings/OutcomeModal.vue'

describe('OutcomeModal', () => {
  it('offers the outcomes from an offer with their offer-specific labels', async () => {
    const wrapper = await mountSuspended(OutcomeModal, {
      props: {
        open: true,
        listingId: 1,
        outcomes: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
        labels: { ACCEPTED: 'Accepted', REJECTED: 'Offer withdrawn', WITHDRAWN: 'Declined' },
        appliedAt: undefined
      },
      attachTo: document.body
    })
    await flushPromises()

    // The modal is teleported to <body>, outside the wrapper.
    const text = document.body.textContent
    expect(text).toContain('Accepted')
    expect(text).toContain('Offer withdrawn')
    expect(text).toContain('Declined')
    expect(text).not.toContain('Rejected')
    wrapper.unmount()
  })
})

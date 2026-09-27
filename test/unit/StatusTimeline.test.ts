import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import StatusTimeline from '~/components/listings/StatusTimeline.vue'
import type { ListingDetail } from '~/composables/useListing'

const listing = {
  id: 1,
  status: 'INTERVIEWING',
  statusHistory: [
    { id: 1, status: 'APPLIED', occurredAt: '2026-09-01T10:00:00Z', note: 'Sent via **email**' },
    { id: 2, status: 'INTERVIEWING', occurredAt: '2026-09-10T10:00:00Z', note: null }
  ]
} as ListingDetail

describe('StatusTimeline', () => {
  it('undoes the newest step after confirming', async () => {
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: () => ({ data: { undoStatusChange: { listing: { id: 1 }, errors: null } } })
    })

    const wrapper = await mountSuspended(StatusTimeline, {
      props: { listing },
      attachTo: document.body
    })
    expect(wrapper.text()).toContain('Applied')
    expect(wrapper.html()).toContain('<strong>email</strong>')

    // Only the newest entry can be undone.
    const undo = wrapper.findAll('[data-testid="status-undo"]')
    expect(undo).toHaveLength(1)
    expect(undo[0]!.text()).toBe('Undo Interviewing')

    await undo[0]!.trigger('click')
    await flushPromises()
    // The confirm modal is teleported to <body>, outside the wrapper.
    document.body.querySelector<HTMLButtonElement>('[data-testid="confirm-modal-confirm"]')!.click()
    await flushPromises()

    expect(wrapper.emitted('changed')).toHaveLength(1)
    wrapper.unmount()
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import OutcomeModal from '~/components/listings/OutcomeModal.vue'

const mountModal = async (props: Record<string, unknown> = {}) => {
  const wrapper = await mountSuspended(OutcomeModal, {
    props: {
      open: true,
      listingId: 1,
      outcomes: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
      appliedAt: undefined,
      ...props
    },
    attachTo: document.body
  })
  await flushPromises()
  return wrapper
}

// The modal is teleported to <body>, outside the wrapper.
const dialog = () => document.body.querySelector('[role="dialog"]')!

afterEach(() => {
  document.body.innerHTML = ''
})

describe('OutcomeModal', () => {
  it('offers the outcomes from an offer with their offer-specific labels', async () => {
    const wrapper = await mountModal({
      labels: { ACCEPTED: 'Accepted', REJECTED: 'Offer withdrawn', WITHDRAWN: 'Declined' }
    })

    const text = dialog().textContent
    expect(text).toContain('Accepted')
    expect(text).toContain('Offer withdrawn')
    expect(text).toContain('Declined')
    expect(text).not.toContain('Rejected')
    wrapper.unmount()
  })

  it('is titled Record outcome unless told otherwise', async () => {
    const plain = await mountModal()
    expect(dialog().querySelector('h2')?.textContent).toBe('Record outcome')
    plain.unmount()
    document.body.innerHTML = ''

    const decision = await mountModal({ title: 'Record decision' })
    expect(dialog().querySelector('h2')?.textContent).toBe('Record decision')
    decision.unmount()
  })

  it('records the only possible outcome without a choice', async () => {
    const inputs: unknown[] = []
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: async (event) => {
        inputs.push((await readBody(event)).variables.input)
        return { data: { recordOutcome: { listing: { id: 1 }, errors: null } } }
      }
    })
    // The card mounts it closed; opening is what fills the defaults.
    const wrapper = await mountModal({ outcomes: ['ACCEPTED'], open: false })
    await wrapper.setProps({ open: true })
    await flushPromises()

    document.body.querySelector<HTMLButtonElement>('[data-testid="confirm-modal-confirm"]')!.click()
    await vi.waitFor(() => expect(wrapper.emitted('changed')).toHaveLength(1))
    expect(inputs).toEqual([
      { listingId: 1, outcome: 'ACCEPTED', occurredAt: expect.any(String), note: '' }
    ])
    wrapper.unmount()
  })
})

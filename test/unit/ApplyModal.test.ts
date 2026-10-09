import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import ApplyModal from '~/components/listings/ApplyModal.vue'
import type { ListingDetail } from '~/composables/useListing'

let sentInput: Record<string, unknown> | undefined
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    sentInput = (await readBody(event)).variables.input
    return { data: { applyToListing: { listing: { id: 5 }, errors: null } } }
  }
})

describe('ApplyModal', () => {
  it('applies without any documents', async () => {
    const wrapper = await mountSuspended(ApplyModal, {
      props: { open: false, listing: { id: 5, documents: [] } as unknown as ListingDetail },
      attachTo: document.body
    })
    // The form resets (and fills in the applied date) when the modal opens.
    await wrapper.setProps({ open: true })
    await flushPromises()

    expect(document.body.textContent).toContain('No CV? Say how you applied in the note.')
    const confirm = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="confirm-modal-confirm"]'
    )!
    expect(confirm.disabled).toBe(false)
    confirm.click()

    await vi.waitFor(() => expect(wrapper.emitted('changed')).toBeTruthy())
    expect(sentInput).toMatchObject({
      listingId: 5,
      cvDocumentId: null,
      coverLetterDocumentId: null
    })
    wrapper.unmount()
  })
})

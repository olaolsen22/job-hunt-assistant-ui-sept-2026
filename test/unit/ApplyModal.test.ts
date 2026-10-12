import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import ApplyModal from '~/components/listings/ApplyModal.vue'
import type { ListingDetail } from '~/composables/useListing'

let sentInput: Record<string, unknown> | undefined
let tailoredCvDraft: unknown = null
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = await readBody(event)
    if (body.query.includes('query TailoredCvDraft')) return { data: { tailoredCvDraft } }
    sentInput = body.variables.input
    return { data: { applyToListing: { listing: { id: 5 }, errors: null } } }
  }
})

const mountOpen = async (documents: unknown[] = [], cvDocumentId?: number) => {
  const wrapper = await mountSuspended(ApplyModal, {
    props: {
      open: false,
      listing: { id: 5, documents } as unknown as ListingDetail,
      cvDocumentId
    },
    attachTo: document.body
  })
  // The form resets (and fills in the applied date) when the modal opens.
  await wrapper.setProps({ open: true })
  await flushPromises()
  return wrapper
}

describe('ApplyModal', () => {
  beforeEach(() => clearNuxtData())

  it('applies without any documents', async () => {
    const wrapper = await mountOpen()

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
  it('links to tailoring a CV only while the listing has no draft', async () => {
    tailoredCvDraft = null
    let wrapper = await mountOpen()
    await vi.waitFor(() =>
      expect(
        document.body.querySelector('[data-testid="apply-tailor-cv"] a')?.getAttribute('href')
      ).toBe('/listings/5/cv')
    )
    wrapper.unmount()

    clearNuxtData()
    tailoredCvDraft = { id: 1, updatedAt: '2026-10-12T10:00:00Z', content: {} }
    wrapper = await mountOpen()
    await flushPromises()
    expect(document.body.textContent).toContain('Applied at')
    expect(document.body.querySelector('[data-testid="apply-tailor-cv"]')).toBeNull()
    wrapper.unmount()
  })
  it('offers a generated unsent CV, but not one that was already sent', async () => {
    let wrapper = await mountOpen([
      { id: 70, kind: 'CV', fileName: 'cv.pdf', sentAt: null },
      { id: 71, kind: 'CV', fileName: 'old.pdf', sentAt: '2026-10-01T10:00:00Z' }
    ])
    expect(document.body.textContent).toContain('Pick an uploaded file')
    wrapper.unmount()

    wrapper = await mountOpen([
      { id: 71, kind: 'CV', fileName: 'old.pdf', sentAt: '2026-10-01T10:00:00Z' }
    ])
    expect(document.body.textContent).not.toContain('Pick an uploaded file')
    wrapper.unmount()
  })
  it('sends a preselected CV, and starts empty without one', async () => {
    const documents = [{ id: 70, kind: 'CV', fileName: 'cv.pdf', sentAt: null }]
    let wrapper = await mountOpen(documents, 70)
    document.body.querySelector<HTMLButtonElement>('[data-testid="confirm-modal-confirm"]')!.click()
    await vi.waitFor(() => expect(wrapper.emitted('changed')).toBeTruthy())
    expect(sentInput).toMatchObject({ cvDocumentId: 70 })
    wrapper.unmount()

    wrapper = await mountOpen(documents)
    document.body.querySelector<HTMLButtonElement>('[data-testid="confirm-modal-confirm"]')!.click()
    await vi.waitFor(() => expect(wrapper.emitted('changed')).toBeTruthy())
    expect(sentInput).toMatchObject({ cvDocumentId: null })
    wrapper.unmount()
  })
})

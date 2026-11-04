import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, readBody } from 'h3'
import ApplyModal from '~/components/listings/ApplyModal.vue'
import DocumentPicker from '~/components/listings/DocumentPicker.vue'
import type { ListingDetail } from '~/composables/useListing'

let sentInput: Record<string, unknown> | undefined
let tailoredCvDraft: unknown = null
let uploadKinds: string[] = []
let failCoverUpload = false
let generated: Record<string, unknown>[] = []
let failApplyOnce = false
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = await readBody(event)
    // Nuxt's in-process fetch passes multipart bodies as opaque strings.
    if (typeof body === 'string') {
      const kind = uploadKinds.length === 0 ? 'CV' : 'COVER_LETTER'
      uploadKinds.push(kind)
      if (kind === 'COVER_LETTER' && failCoverUpload) {
        failCoverUpload = false
        throw createError({ statusCode: 400, message: 'Upload failed' })
      }
      return {
        data: { uploadDocument: { document: { id: kind === 'CV' ? 80 : 81 }, errors: null } }
      }
    }
    if (body.query.includes('query TailoredCvDraft')) return { data: { tailoredCvDraft } }
    if (body.query.includes('query BaseCvs('))
      return {
        data: {
          baseCvs: [
            {
              id: 4,
              name: 'Frontend (EN)',
              description: null,
              language: 'ENGLISH',
              archivedAt: null,
              updatedAt: '2026-10-30T10:00:00Z',
              latestVersion: { id: 42, number: 2 },
              versions: [
                { id: 42, number: 2, note: null, createdAt: '2026-10-30T10:00:00Z' },
                { id: 41, number: 1, note: null, createdAt: '2026-10-20T10:00:00Z' }
              ]
            }
          ]
        }
      }
    if (body.query.includes('mutation GenerateBaseCvDocument')) {
      generated.push(body.variables)
      return { data: { generateBaseCvDocument: { document: { id: 90 }, errors: null } } }
    }
    if (failApplyOnce) {
      failApplyOnce = false
      return {
        data: {
          applyToListing: {
            listing: null,
            errors: [{ __typename: 'InvalidApplicationError', message: 'Try again' }]
          }
        }
      }
    }
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
  it('keeps the date and note after cancellation and resets after success', async () => {
    const wrapper = await mountOpen()
    const date = document.body.querySelector<HTMLInputElement>('input[type="datetime-local"]')!
    date.value = '2026-10-01T10:00'
    date.dispatchEvent(new Event('input', { bubbles: true }))
    const note = document.body.querySelector<HTMLTextAreaElement>('textarea')!
    note.value = 'Applied through the company portal'
    note.dispatchEvent(new Event('input', { bubbles: true }))
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await flushPromises()
    expect(
      document.body.querySelector<HTMLInputElement>('input[type="datetime-local"]')!.value
    ).toBe('2026-10-01T10:00')
    expect(document.body.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe(
      'Applied through the company portal'
    )
    document.body.querySelector<HTMLButtonElement>('[data-testid="confirm-modal-confirm"]')!.click()
    await vi.waitFor(() => expect(wrapper.emitted('changed')).toBeTruthy())
    expect(sentInput?.note).toBe('Applied through the company portal')
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await flushPromises()
    expect(document.body.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('')
    wrapper.unmount()
  })

  it('keeps a successful upload when the other request fails and retries only the failed file', async () => {
    const wrapper = await mountOpen()
    uploadKinds = []
    failCoverUpload = true
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:upload')
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    try {
      const pickers = wrapper.findAllComponents(DocumentPicker)
      pickers[0]!.vm.$emit('update:file', new File(['cv'], 'cv.pdf'))
      pickers[1]!.vm.$emit('update:file', new File(['cover'], 'cover.pdf'))
      await flushPromises()
      document.body
        .querySelector<HTMLButtonElement>('[data-testid="confirm-modal-confirm"]')!
        .click()
      await vi.waitFor(() => expect(uploadKinds).toEqual(['CV', 'COVER_LETTER']))
      await flushPromises()
      expect(wrapper.emitted('changed')).toBeFalsy()
      expect(pickers[0]!.props('documentId')).toBe(80)
      document.body
        .querySelector<HTMLButtonElement>('[data-testid="confirm-modal-confirm"]')!
        .click()
      await vi.waitFor(() => expect(wrapper.emitted('changed')).toBeTruthy())
      expect(uploadKinds).toEqual(['CV', 'COVER_LETTER', 'COVER_LETTER'])
      expect(sentInput).toMatchObject({ cvDocumentId: 80, coverLetterDocumentId: 81 })
    } finally {
      wrapper.unmount()
      createUrl.mockRestore()
      revokeUrl.mockRestore()
    }
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
  it('makes a CV template version into the CV only on submit, once even when retried', async () => {
    generated = []
    failApplyOnce = true
    const wrapper = await mountOpen()
    await vi.waitFor(() => expect(document.body.textContent).toContain('Or use a CV template'))
    expect(generated).toEqual([])

    // The picker's template choice sets the version, defaulting to the latest.
    wrapper.findAllComponents(DocumentPicker)[0]!.vm.$emit('update:baseCvVersionId', 42)
    await flushPromises()
    const confirm = () =>
      document.body.querySelector<HTMLButtonElement>('[data-testid="confirm-modal-confirm"]')!
    confirm().click()
    await vi.waitFor(() => expect(generated).toHaveLength(1))
    await flushPromises()
    expect(generated[0]).toEqual({ listingId: 5, baseCvVersionId: 42 })
    expect(wrapper.emitted('changed')).toBeFalsy()
    // The failed apply leaves the chosen template on show.
    expect(wrapper.findAllComponents(DocumentPicker)[0]!.props('baseCvVersionId')).toBe(42)

    confirm().click()
    await vi.waitFor(() => expect(wrapper.emitted('changed')).toBeTruthy())
    expect(generated).toHaveLength(1)
    expect(sentInput).toMatchObject({ cvDocumentId: 90 })
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
  it('preselects the newest unsent cover letter', async () => {
    const wrapper = await mountOpen([
      {
        id: 90,
        kind: 'COVER_LETTER',
        fileName: 'old.pdf',
        createdAt: '2026-10-01T10:00:00Z',
        sentAt: null
      },
      {
        id: 91,
        kind: 'COVER_LETTER',
        fileName: 'new.pdf',
        createdAt: '2026-10-03T10:00:00Z',
        sentAt: null
      },
      {
        id: 92,
        kind: 'COVER_LETTER',
        fileName: 'sent.pdf',
        createdAt: '2026-10-05T10:00:00Z',
        sentAt: '2026-10-06T10:00:00Z'
      }
    ])
    document.body.querySelector<HTMLButtonElement>('[data-testid="confirm-modal-confirm"]')!.click()
    await vi.waitFor(() => expect(wrapper.emitted('changed')).toBeTruthy())
    expect(sentInput).toMatchObject({ cvDocumentId: null, coverLetterDocumentId: 91 })
    wrapper.unmount()
  })
})

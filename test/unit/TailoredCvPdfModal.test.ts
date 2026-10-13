import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { setResponseHeader } from 'h3'
import TailoredCvPdfModal from '~/components/listings/TailoredCvPdfModal.vue'

// Served the way a download would be, to prove the preview still only displays it.
let documentReply: () => unknown = () => '%PDF-1.4'
registerEndpoint('/api/documents/70', (event) => {
  setResponseHeader(event, 'content-type', 'application/pdf')
  setResponseHeader(event, 'content-disposition', 'attachment; filename="cv.pdf"')
  return documentReply()
})

const el = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`)

const mountOpen = async (applicable = false) => {
  const wrapper = await mountSuspended(TailoredCvPdfModal, {
    props: { open: true, documentId: 70, fileName: 'cv.pdf', applicable },
    attachTo: document.body
  })
  await flushPromises()
  return wrapper
}

// Node's URL rejects the test DOM's Blob, so object URLs are stubbed; browsers make real ones.
beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:cv-preview')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  documentReply = () => '%PDF-1.4'
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('TailoredCvPdfModal', () => {
  it('shows a skeleton until the frame loads', async () => {
    const wrapper = await mountOpen()
    expect(el('cv-pdf-loading')).not.toBeNull()
    el('cv-pdf-frame')!.dispatchEvent(new Event('load'))
    await flushPromises()
    expect(el('cv-pdf-loading')).toBeNull()
    wrapper.unmount()
  })

  it('highlights the Open PDF link after 10 s and gives up on the preview after 30 s', async () => {
    vi.useFakeTimers()
    const wrapper = await mountOpen()
    expect(document.body.textContent).not.toContain('Taking a while')

    await vi.advanceTimersByTimeAsync(10_000)
    expect(document.body.textContent).toContain('Taking a while')
    expect(el('cv-pdf-frame')).not.toBeNull()

    await vi.advanceTimersByTimeAsync(20_000)
    expect(el('cv-pdf-gave-up')).not.toBeNull()
    expect(el('cv-pdf-frame')).toBeNull()
    expect(el('cv-pdf-open')!.getAttribute('href')).toBe('blob:cv-preview')
    wrapper.unmount()
  })

  it('does not show the fallback once the frame has loaded', async () => {
    vi.useFakeTimers()
    const wrapper = await mountOpen()
    el('cv-pdf-frame')!.dispatchEvent(new Event('load'))
    await vi.advanceTimersByTimeAsync(40_000)
    expect(el('cv-pdf-gave-up')).toBeNull()
    expect(el('cv-pdf-frame')).not.toBeNull()
    wrapper.unmount()
  })

  it('offers Apply with this CV only when applicable', async () => {
    let wrapper = await mountOpen()
    expect(el('cv-pdf-apply')).toBeNull()
    wrapper.unmount()

    wrapper = await mountOpen(true)
    el('cv-pdf-apply')!.click()
    expect(wrapper.emitted('apply')).toHaveLength(1)
    wrapper.unmount()
  })

  it('downloads only on request, and skips the frame in a browser without a PDF viewer', async () => {
    let wrapper = await mountOpen()
    expect(el('cv-pdf-download')!.hasAttribute('download')).toBe(true)
    expect(el('cv-pdf-download')!.getAttribute('href')).toBe('/api/documents/70')
    wrapper.unmount()

    vi.stubGlobal('navigator', { ...navigator, pdfViewerEnabled: false })
    wrapper = await mountOpen()
    expect(el('cv-pdf-frame')).toBeNull()
    expect(el('cv-pdf-no-viewer')).not.toBeNull()
    expect(el('cv-pdf-download')).not.toBeNull()
    wrapper.unmount()
  })

  it('frames a local copy of the PDF, never the download URL', async () => {
    const wrapper = await mountOpen()
    await vi.waitFor(() => expect(el('cv-pdf-frame')).not.toBeNull())
    expect(el('cv-pdf-frame')!.getAttribute('src')).toBe('blob:cv-preview')
    expect(el('cv-pdf-open')!.getAttribute('href')).toBe('blob:cv-preview')
    wrapper.unmount()
  })

  it('offers Open PDF when the file cannot be fetched', async () => {
    documentReply = () => {
      throw createError({ statusCode: 500 })
    }
    const wrapper = await mountOpen()
    await vi.waitFor(() => expect(el('cv-pdf-gave-up')).not.toBeNull())
    expect(el('cv-pdf-open')!.getAttribute('href')).toBe('/api/documents/70')
    wrapper.unmount()
  })
})

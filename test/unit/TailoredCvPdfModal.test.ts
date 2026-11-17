import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { setResponseHeader } from 'h3'
import TailoredCvPdfModal from '~/components/listings/TailoredCvPdfModal.vue'

// Served the way a download would be, to prove the preview still only displays it.
// The server names the file itself; `fileName` is only the in-app label.
const SERVER_DISPOSITION =
  'attachment; filename="Ola_Acme_Dev_Cv.pdf"; filename*=UTF-8\'\'%C3%85se_Acme_Dev_Cv.pdf'
let documentReply: () => unknown = () => '%PDF-1.4'
let disposition: string | undefined = SERVER_DISPOSITION
registerEndpoint('/api/documents/70', (event) => {
  setResponseHeader(event, 'content-type', 'application/pdf')
  if (disposition) setResponseHeader(event, 'content-disposition', disposition)
  return documentReply()
})

const el = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`)

const mountOpen = async (applicable = false) => {
  const wrapper = await mountSuspended(TailoredCvPdfModal, {
    props: { open: true, url: '/api/documents/70', fileName: 'cv.pdf', applicable },
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
  disposition = SERVER_DISPOSITION
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

  it('offers Mark as applied with this PDF only when applicable', async () => {
    let wrapper = await mountOpen()
    expect(el('cv-pdf-apply')).toBeNull()
    wrapper.unmount()

    wrapper = await mountOpen(true)
    expect(el('cv-pdf-apply')!.textContent?.trim()).toBe('Mark as applied with this PDF')
    el('cv-pdf-apply')!.click()
    expect(wrapper.emitted('apply')).toHaveLength(1)
    wrapper.unmount()
  })

  it('downloads only on request, and skips the frame in a browser without a PDF viewer', async () => {
    let wrapper = await mountOpen()
    // No value, so the browser saves under the server's Content-Disposition name.
    expect(el('cv-pdf-download')!.getAttribute('download')).toBe('')
    expect(el('cv-pdf-download')!.getAttribute('href')).toBe('/api/documents/70')
    wrapper.unmount()

    vi.stubGlobal('navigator', { ...navigator, pdfViewerEnabled: false })
    wrapper = await mountOpen()
    expect(el('cv-pdf-frame')).toBeNull()
    expect(el('cv-pdf-no-viewer')).not.toBeNull()
    expect(el('cv-pdf-download')).not.toBeNull()
    wrapper.unmount()
  })

  it('saves through the share sheet in an iOS Home Screen app, where download links do nothing', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, standalone: true, share })
    const wrapper = await mountOpen()
    expect(el('cv-pdf-download')!.hasAttribute('href')).toBe(false)
    el('cv-pdf-download')!.click()
    await vi.waitFor(() => expect(share).toHaveBeenCalledOnce())
    const [pdf] = share.mock.calls[0]![0].files
    expect(pdf.name).toBe('Åse_Acme_Dev_Cv.pdf')
    expect(pdf.type).toBe('application/pdf')
    wrapper.unmount()
  })

  it('names a shared file from a plain filename, or falls back to fileName without one', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, standalone: true, share })
    const sharedName = async () => {
      share.mockClear()
      const wrapper = await mountOpen()
      el('cv-pdf-download')!.click()
      await vi.waitFor(() => expect(share).toHaveBeenCalledOnce())
      wrapper.unmount()
      return share.mock.calls[0]![0].files[0].name
    }

    disposition = 'attachment; filename="Ola_Acme_Dev_Cv.pdf"'
    expect(await sharedName()).toBe('Ola_Acme_Dev_Cv.pdf')
    disposition = undefined
    expect(await sharedName()).toBe('cv.pdf')
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

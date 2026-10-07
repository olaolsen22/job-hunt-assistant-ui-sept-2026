import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import ParseModal from '~/components/listings/ParseModal.vue'

const mountOpen = (props: { listingId?: number }) =>
  mountSuspended(ParseModal, { props: { open: true, ...props }, attachTo: document.body })

const click = async (testid: string) => {
  document.body.querySelector<HTMLElement>(`[data-testid="${testid}"]`)?.click()
  await flushPromises()
}

// One endpoint for the whole file: a later registerEndpoint on the same path doesn't replace it.
let urlParseResponse: object = {}
let builtInResponse: object = {}
registerEndpoint('/graphql', {
  method: 'POST',
  handler: () => ({
    data: {
      parseListingFromUrl: urlParseResponse,
      parseListing: builtInResponse,
      prompt: { instructions: 'x' },
      llmUsageToday: {
        requests: 3,
        inputTokens: 1200,
        outputTokens: 340,
        requestsLimit: 50,
        remainingRequests: 47,
        resetsAt: '2026-10-08T00:00:00Z'
      }
    }
  })
})
const respondToUrlParse = (payload: object) => (urlParseResponse = payload)
const respondToBuiltInParse = (payload: object) => (builtInResponse = payload)

describe('ParseModal', () => {
  it('loads the prompt when it is mounted already open', async () => {
    const wrapper = await mountSuspended(ParseModal, {
      props: { open: true },
      attachTo: document.body
    })
    // The copy button lives on the Use your own AI tab.
    wrapper.vm.tab = 'ai'
    await flushPromises()

    const copy = document.body.querySelector('[data-testid="parse-copy-prompt"]')
    expect(copy?.querySelector('.animate-spin, [class*="loader"]')).toBeNull()
    wrapper.unmount()
  })

  it('emits the parsed draft from the saved listing and closes', async () => {
    respondToUrlParse({
      parseJob: { status: 'SUCCEEDED', result: '{"title":"Dev"}', error: null },
      errors: null
    })
    const wrapper = await mountOpen({ listingId: 7 })
    await click('parse-url')

    await vi.waitFor(() => expect(wrapper.emitted('apply')?.[0]).toEqual([{ title: 'Dev' }]))
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
    wrapper.unmount()
  })

  it('only offers Parse from link for a saved listing', async () => {
    const wrapper = await mountOpen({})
    expect(document.body.querySelector('[data-testid="parse-url"]')).toBeNull()
    wrapper.unmount()
  })

  it('shows why the page could not be parsed and keeps the modal open', async () => {
    respondToUrlParse({
      parseJob: null,
      errors: [{ __typename: 'InvalidParseRequestError', message: 'Page unreadable' }]
    })
    const wrapper = await mountOpen({ listingId: 7 })
    await click('parse-url')

    await vi.waitFor(() =>
      expect(document.body.querySelector('[data-testid="parse-url-error"]')?.textContent).toContain(
        'Page unreadable'
      )
    )
    expect(wrapper.emitted('apply')).toBeUndefined()
    wrapper.unmount()
  })

  it('shows a built-in parse error in the tab and keeps the pasted ad', async () => {
    respondToBuiltInParse({
      parseJob: null,
      errors: [{ __typename: 'InvalidParseRequestError', message: 'Ad too short' }]
    })
    const wrapper = await mountOpen({})
    const ad = document.body.querySelector<HTMLTextAreaElement>('[data-testid="parse-ad"]')!
    ad.value = 'Some ad'
    ad.dispatchEvent(new Event('input'))
    await flushPromises()
    await click('parse-builtin-run')

    await vi.waitFor(() =>
      expect(
        document.body.querySelector('[data-testid="parse-builtin-error"]')?.textContent
      ).toContain('Ad too short')
    )
    expect(wrapper.vm.tab).toBe('paste')
    expect(
      document.body.querySelector<HTMLTextAreaElement>('[data-testid="parse-ad"]')!.value
    ).toBe('Some ad')
    wrapper.unmount()
  })

  it('warns about AI cost on From link and Paste ad, not on Use your own AI', async () => {
    const wrapper = await mountOpen({ listingId: 7 })
    const notice = () => document.body.querySelector('[data-testid="parse-cost-notice"]')

    expect(notice()).not.toBeNull()
    const line = (id: string) => document.body.querySelector(`[data-testid="${id}"]`)?.textContent
    await vi.waitFor(() => expect(line('parse-usage-tokens')).toContain('1,200 tokens in'))
    expect(line('parse-usage-tokens')).toContain('340 out')
    expect(line('parse-usage-requests')).toContain('3 of 50 requests')
    wrapper.vm.tab = 'paste'
    await flushPromises()
    expect(notice()).not.toBeNull()
    wrapper.vm.tab = 'ai'
    await flushPromises()
    expect(notice()).toBeNull()
    wrapper.unmount()
  })
})

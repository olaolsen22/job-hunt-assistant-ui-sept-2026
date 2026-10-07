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
registerEndpoint('/graphql', {
  method: 'POST',
  handler: () => ({
    data: { parseListingFromUrl: urlParseResponse, prompt: { instructions: 'x' } }
  })
})
const respondToUrlParse = (payload: object) => (urlParseResponse = payload)

describe('ParseModal', () => {
  it('loads the prompt when it is mounted already open', async () => {
    const wrapper = await mountSuspended(ParseModal, {
      props: { open: true },
      attachTo: document.body
    })
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

  it('only offers Parse automatically for a saved listing', async () => {
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
})

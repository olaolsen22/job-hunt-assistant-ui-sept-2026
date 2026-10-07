import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import ParseModal from '~/components/listings/ParseModal.vue'

describe('ParseModal', () => {
  it('loads the prompt when it is mounted already open', async () => {
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: () => ({ data: { prompt: { instructions: 'x' } } })
    })
    const wrapper = await mountSuspended(ParseModal, {
      props: { open: true },
      attachTo: document.body
    })
    await flushPromises()

    const copy = document.body.querySelector('[data-testid="parse-copy-prompt"]')
    expect(copy?.querySelector('.animate-spin, [class*="loader"]')).toBeNull()
    wrapper.unmount()
  })
})

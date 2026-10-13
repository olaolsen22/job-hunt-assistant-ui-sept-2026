import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AiRetryConfirm from '~/components/app/AiRetryConfirm.vue'

describe('AiRetryConfirm', () => {
  it('shows the API message and asks before another run', async () => {
    const wrapper = await mountSuspended(AiRetryConfirm, {
      props: { message: 'The run was interrupted.' }
    })
    expect(wrapper.text()).toContain('may already have been charged')
    expect(wrapper.text()).toContain('The run was interrupted.')

    await wrapper.get('[data-testid="ai-retry-confirm-run"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})

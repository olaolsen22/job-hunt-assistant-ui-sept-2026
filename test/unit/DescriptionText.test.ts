import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import DescriptionText from '~/components/listings/DescriptionText.vue'

const SOURCE = '## Role\n\n- **Vue** work\n- APIs'

describe('Listing description text', () => {
  it('renders the summary as markdown', async () => {
    const wrapper = await mountSuspended(DescriptionText, {
      props: { text: SOURCE, markdown: true }
    })
    const box = wrapper.get('[data-testid="listing-description-text"]')
    // The markdown renderer is a lazy component, so wait for its chunk.
    await vi.waitFor(() => expect(box.findAll('li')).toHaveLength(2))
    expect(box.find('strong').text()).toBe('Vue')
  })

  it('keeps the original posting as plain text', async () => {
    const wrapper = await mountSuspended(DescriptionText, { props: { text: SOURCE } })
    const box = wrapper.get('[data-testid="listing-description-text"]')
    expect(box.find('li').exists()).toBe(false)
    expect(box.text()).toContain('- **Vue** work')
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import TailoredCvCard from '~/components/listings/TailoredCvCard.vue'
import { tailoredCvFromProfile, toTailoredCvInput } from '~/utils/tailoredCv'
import { cvProfile } from '../fixtures/profileCv'

let savedDraft: unknown
registerEndpoint('/graphql', {
  method: 'POST',
  handler: () => ({ data: { tailoredCvDraft: savedDraft } })
})

const mountCard = async () => {
  const wrapper = await mountSuspended(TailoredCvCard, { props: { listingId: 5 } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  clearNuxtData()
  savedDraft = null
})

describe('Tailored CV card', () => {
  it('offers Create draft when the listing has no draft', async () => {
    const wrapper = await mountCard()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="tailored-cv-card-empty"]').exists()).toBe(true)
    )
    expect(wrapper.get('[data-testid="tailored-cv-card-create"]').attributes('href')).toBe(
      '/listings/5/cv'
    )
    expect(wrapper.find('[data-testid="tailored-cv-saved"]').exists()).toBe(false)
  })

  it('shows the saved state with Edit and Copy as text', async () => {
    savedDraft = {
      id: 1,
      updatedAt: '2026-10-12T10:00:00Z',
      content: toTailoredCvInput(tailoredCvFromProfile(cvProfile()))
    }
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const wrapper = await mountCard()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="tailored-cv-saved"]').exists()).toBe(true)
    )
    expect(wrapper.get('[data-testid="tailored-cv-card-edit"]').attributes('href')).toBe(
      '/listings/5/cv'
    )

    await wrapper.get('[data-testid="tailored-cv-card-copy"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/^Existing owner\nEngineer/))
    vi.unstubAllGlobals()
  })
})

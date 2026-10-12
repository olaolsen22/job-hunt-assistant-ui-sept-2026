import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import TailoredCvCard from '~/components/listings/TailoredCvCard.vue'
import type { ListingDetail } from '~/composables/useListing'
import { tailoredCvFromProfile, toTailoredCvInput } from '~/utils/tailoredCv'
import { cvProfile } from '../fixtures/profileCv'

let savedDraft: unknown
let appliedInput: Record<string, unknown> | undefined
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = await readBody(event)
    if (!body.query.includes('mutation ApplyToListing'))
      return { data: { tailoredCvDraft: savedDraft } }
    appliedInput = body.variables.input
    return { data: { applyToListing: { listing: { id: 5 }, errors: null } } }
  }
})

const pdf = { id: 60, kind: 'CV', fileName: 'tailored.pdf', createdAt: '2026-10-12T11:00:00Z' }

const mountCard = async (documents: unknown[] = [], status = 'SAVED') => {
  const wrapper = await mountSuspended(TailoredCvCard, {
    props: { listing: { id: 5, status, documents } as unknown as ListingDetail },
    attachTo: document.body
  })
  await flushPromises()
  return wrapper
}
const withDraft = () => {
  savedDraft = {
    id: 1,
    updatedAt: '2026-10-12T10:00:00Z',
    content: toTailoredCvInput(tailoredCvFromProfile(cvProfile()))
  }
}

beforeEach(() => {
  clearNuxtData()
  savedDraft = null
})

describe('Tailored CV card', () => {
  it('offers Tailor CV when the listing has no draft', async () => {
    const wrapper = await mountCard()
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="tailored-cv-card-empty"]').exists()).toBe(true)
    )
    expect(wrapper.get('[data-testid="tailored-cv-card-create"]').attributes('href')).toBe(
      '/listings/5/cv'
    )
    expect(wrapper.get('[data-testid="tailored-cv-card-create"]').text()).toBe('Tailor CV')
    expect(wrapper.find('[data-testid="tailored-cv-saved"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows the saved state with Edit and Copy as text, and no PDF row without one', async () => {
    withDraft()
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
    expect(wrapper.find('[data-testid="tailored-cv-card-pdf"]').exists()).toBe(false)
    vi.unstubAllGlobals()
    wrapper.unmount()
  })

  it('shows the latest PDF and applies with it preselected', async () => {
    withDraft()
    const wrapper = await mountCard([pdf, { ...pdf, id: 50, createdAt: '2026-10-01T10:00:00Z' }])
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="tailored-cv-card-pdf"]').exists()).toBe(true)
    )
    expect(wrapper.get('[data-testid="tailored-cv-card-pdf"]').text()).toContain('tailored.pdf')

    await wrapper.get('[data-testid="tailored-cv-card-apply"]').trigger('click')
    await vi.waitFor(() =>
      expect(document.body.querySelector('[data-testid="confirm-modal-confirm"]')).not.toBeNull()
    )
    document.body.querySelector<HTMLButtonElement>('[data-testid="confirm-modal-confirm"]')!.click()
    await vi.waitFor(() => expect(wrapper.emitted('changed')).toBeTruthy())
    expect(appliedInput).toMatchObject({ cvDocumentId: 60 })
    wrapper.unmount()
  })

  it('offers only Preview once the listing is past Saved', async () => {
    withDraft()
    const wrapper = await mountCard([pdf], 'APPLIED')
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="tailored-cv-card-preview"]').exists()).toBe(true)
    )
    expect(wrapper.find('[data-testid="tailored-cv-card-apply"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

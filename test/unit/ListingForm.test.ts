import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import ListingForm from '~/components/listings/Form.vue'
import { useListingForm } from '~/composables/useListingForm'

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))
// Comboboxes in the form may look up companies, roles or skills.
registerEndpoint('/graphql', { method: 'POST', handler: () => ({ data: null }) })

const mountForm = async (setup: (state: ReturnType<typeof useListingForm>['state']) => void) => {
  const { state, validate } = useListingForm()
  setup(state)
  const wrapper = await mountSuspended(ListingForm, {
    props: { modelValue: state, validate, submitLabel: 'Save changes', cancelTo: '/listings/5' }
  })
  return { wrapper, state }
}
const original = (wrapper: Awaited<ReturnType<typeof mountForm>>['wrapper']) =>
  wrapper.find('[data-testid="listing-form-original-description"]')
const labels = (wrapper: Awaited<ReturnType<typeof mountForm>>['wrapper']) =>
  wrapper.findAll('label').map((l) => l.text())

describe('Listing form summary fields', () => {
  it('shows only "Summary" for an ad without a language', async () => {
    const { wrapper } = await mountForm(() => {})
    expect(original(wrapper).exists()).toBe(false)
    expect(labels(wrapper)).toContain('Summary')
    wrapper.unmount()
  })

  it('shows only "Summary" for an English ad', async () => {
    const { wrapper } = await mountForm((s) => {
      s.postingLanguage = 'ENGLISH'
      s.originalDescription = 'Kept from before'
    })
    expect(original(wrapper).exists()).toBe(false)
    expect(labels(wrapper)).toContain('Summary')
    expect(labels(wrapper)).not.toContain('Summary in English')
    wrapper.unmount()
  })

  it('adds a Norwegian summary field for a Norwegian ad and binds it', async () => {
    const { wrapper, state } = await mountForm((s) => {
      s.postingLanguage = 'NORWEGIAN'
      s.originalDescription = 'Bygg Vue-apper.'
    })
    const field = original(wrapper)
    expect(field.exists()).toBe(true)
    expect(labels(wrapper)).toEqual(
      expect.arrayContaining(['Summary in English', 'Summary in Norwegian'])
    )
    const textarea = field.element.tagName === 'TEXTAREA' ? field : field.get('textarea')
    expect((textarea.element as HTMLTextAreaElement).value).toBe('Bygg Vue-apper.')
    expect(textarea.attributes('lang')).toBe('nb')

    await textarea.setValue('Nytt sammendrag')
    expect(state.originalDescription).toBe('Nytt sammendrag')
    wrapper.unmount()
  })

  it('hides the Norwegian field without clearing it when the ad becomes English', async () => {
    const { wrapper, state } = await mountForm((s) => {
      s.postingLanguage = 'NORWEGIAN'
      s.originalDescription = 'Bygg Vue-apper.'
    })
    expect(original(wrapper).exists()).toBe(true)

    state.postingLanguage = 'ENGLISH'
    await wrapper.vm.$nextTick()
    expect(original(wrapper).exists()).toBe(false)
    expect(state.originalDescription).toBe('Bygg Vue-apper.')

    state.postingLanguage = 'NORWEGIAN'
    await wrapper.vm.$nextTick()
    expect(original(wrapper).exists()).toBe(true)
    wrapper.unmount()
  })
})

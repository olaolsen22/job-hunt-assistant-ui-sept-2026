import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { UFormField, UInput } from '#components'
import AppFormModal from '~/components/app/FormModal.vue'

type State = { name: string }

const mountModal = (state: State) =>
  mountSuspended(AppFormModal, {
    props: {
      open: true,
      title: 'Edit thing',
      state,
      validate: (s: Partial<State>) => (s.name ? [] : [{ name: 'name', message: 'Required' }])
    },
    slots: {
      default: () => h(UFormField, { name: 'name', label: 'Name' }, () => h(UInput))
    },
    attachTo: document.body
  })

const body = () => document.body
const form = () => body().querySelector('form')!
const click = (testid: string) =>
  body().querySelector<HTMLButtonElement>(`[data-testid="${testid}"]`)!.click()

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AppFormModal', () => {
  it('submits a valid form, as Enter in a field does', async () => {
    const wrapper = await mountModal({ name: 'Ada' })
    form().dispatchEvent(new Event('submit'))
    await flushPromises()
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('submits from the footer Save button', async () => {
    const wrapper = await mountModal({ name: 'Ada' })
    click('form-modal-save')
    await flushPromises()
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('shows the error inline and does not submit when invalid', async () => {
    const wrapper = await mountModal({ name: '' })
    form().dispatchEvent(new Event('submit'))
    await flushPromises()
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(body().textContent).toContain('Required')
  })

  it('asks before discarding changes', async () => {
    const wrapper = await mountModal({ name: 'Ada' })
    await wrapper.setProps({ state: { name: 'Grace' } })
    click('form-modal-cancel')
    await flushPromises()
    expect(body().textContent).toContain('Discard changes?')
    expect(wrapper.emitted('update:open')).toBeUndefined()

    click('confirm-modal-confirm')
    await flushPromises()
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('closes an unchanged form without asking', async () => {
    const wrapper = await mountModal({ name: 'Ada' })
    click('form-modal-cancel')
    await flushPromises()
    expect(body().textContent).not.toContain('Discard changes?')
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
  })
})

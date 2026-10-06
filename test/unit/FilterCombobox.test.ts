import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import FilterCombobox from '~/components/listings/FilterCombobox.vue'

describe('FilterCombobox', () => {
  it('emits every picked location id', async () => {
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: () => ({
        data: {
          locations: {
            nodes: [
              { id: 1, city: 'Oslo', countryCode: 'NO' },
              { id: 2, city: 'Bergen', countryCode: 'NO' }
            ]
          }
        }
      })
    })

    const wrapper = await mountSuspended(FilterCombobox, {
      props: { lookup: 'locations', modelValue: [] },
      attachTo: document.body
    })
    await wrapper.get('input').setValue('o')
    // Wait out the search debounce.
    await new Promise((r) => setTimeout(r, 250))
    await flushPromises()

    // The menu is teleported to <body>, outside the wrapper.
    const options = () => [...document.body.querySelectorAll<HTMLElement>('[role="option"]')]
    options()
      .find((o) => o.textContent?.includes('Oslo'))!
      .click()
    await wrapper.setProps({ modelValue: [1] })
    options()
      .find((o) => o.textContent?.includes('Bergen'))!
      .click()

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[1, 2]])
    wrapper.unmount()
  })
})

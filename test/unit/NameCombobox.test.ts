import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import NameCombobox from '~/components/listings/NameCombobox.vue'

describe('NameCombobox', () => {
  it('suggests names from the API while typing', async () => {
    registerEndpoint('/graphql', {
      method: 'POST',
      handler: () => ({ data: { result: { nodes: [{ name: 'Acme' }, { name: 'Acme Labs' }] } } })
    })

    const wrapper = await mountSuspended(NameCombobox, {
      props: { lookup: 'companies' },
      attachTo: document.body
    })
    await wrapper.get('input').setValue('acme')
    // Wait out the search debounce.
    await new Promise((r) => setTimeout(r, 250))
    await flushPromises()

    // The menu is teleported to <body>, outside the wrapper.
    expect(document.body.textContent).toContain('Acme Labs')
    wrapper.unmount()
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import ProfileSection from '~/components/profile/Section.vue'
import { PROFILE_TRANSLATION_KEY } from '~/composables/useProfileTranslation'

const baseProps = {
  title: 'Skills',
  icon: 'i-lucide-wrench',
  empty: false,
  emptyMessage: 'No skills yet.',
  addLabel: 'Add skill',
  testid: 'section'
}

const mountSection = (props = {}, translating?: boolean) =>
  mountSuspended(ProfileSection, {
    props: { ...baseProps, ...props },
    slots: { default: '<p data-testid="body">Vue</p>' },
    global:
      translating === undefined
        ? {}
        : {
            provide: {
              [PROFILE_TRANSLATION_KEY as symbol]: {
                translating: ref(translating),
                target: ref('NORWEGIAN'),
                locale: ref('en-GB'),
                editingKey: ref(null),
                nextUntranslated: () => null
              }
            }
          }
  })

const openMenu = async (wrapper: Awaited<ReturnType<typeof mountSection>>) => {
  await wrapper.get('[data-testid="section-menu"]').trigger('keydown', { key: 'Enter' })
  await flushPromises()
  return [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')]
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ProfileSection', () => {
  it('always shows its content and count, with no toggle', async () => {
    const wrapper = await mountSection({ count: 3 })
    expect(wrapper.find('[aria-expanded]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="body"]').exists()).toBe(true)
    expect(wrapper.get('h2').text()).toBe('Skills · 3')
  })

  it('offers the add action in a single row when empty', async () => {
    const wrapper = await mountSection({ empty: true })
    const empty = wrapper.get('[data-testid="section-empty"]')
    expect(empty.text()).toContain('No skills yet.')
    expect(wrapper.find('[data-testid="body"]').exists()).toBe(false)
    await empty.get('[data-testid="section-add"]').trigger('click')
    expect(wrapper.emitted('add')).toHaveLength(1)
  })

  it('shows a labelled Add in the header when it has content', async () => {
    const wrapper = await mountSection()
    const add = wrapper.get('[data-testid="section-add"]')
    expect(add.text()).toBe('Add')
    expect(add.attributes('aria-label')).toBe('Add skill')
    expect((await mountSection({ full: true })).find('[data-testid="section-add"]').exists()).toBe(
      false
    )
  })

  it('lists its menu items, then Clear section, which emits clear', async () => {
    let tidied = 0
    const wrapper = await mountSection({
      clearable: true,
      menuItems: [{ label: 'Tidy up', onSelect: () => tidied++ }]
    })
    let items = await openMenu(wrapper)
    expect(items.map((el) => el.textContent?.trim())).toEqual(['Tidy up', 'Clear section…'])
    items[0]!.click()
    expect(tidied).toBe(1)
    expect(wrapper.emitted('clear')).toBeUndefined()
    wrapper.unmount()
    document.body.innerHTML = ''

    const again = await mountSection({ clearable: true })
    items = await openMenu(again)
    expect(items.map((el) => el.textContent?.trim())).toEqual(['Clear section…'])
    items[0]!.click()
    expect(again.emitted('clear')).toHaveLength(1)
  })

  it('has no menu when nothing is left to clear and no items are given', async () => {
    expect(
      (await mountSection({ clearable: true, empty: true }))
        .find('[data-testid="section-menu"]')
        .exists()
    ).toBe(false)
    expect((await mountSection()).find('[data-testid="section-menu"]').exists()).toBe(false)
  })

  it('hides Add, the menu and the empty add button in the translated view', async () => {
    const filled = await mountSection({ clearable: true }, true)
    expect(filled.find('[data-testid="section-add"]').exists()).toBe(false)
    expect(filled.find('[data-testid="section-menu"]').exists()).toBe(false)
    expect(filled.find('[data-testid="body"]').exists()).toBe(true)

    const empty = await mountSection({ empty: true }, true)
    expect(empty.get('[data-testid="section-empty"]').text()).toContain('No skills yet.')
    expect(empty.find('[data-testid="section-add"]').exists()).toBe(false)

    const written = await mountSection({ clearable: true }, false)
    expect(written.find('[data-testid="section-add"]').exists()).toBe(true)
    expect(written.find('[data-testid="section-menu"]').exists()).toBe(true)
  })
})

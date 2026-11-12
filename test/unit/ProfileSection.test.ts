import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { nextTick, ref } from 'vue'
import ProfileSection from '~/components/profile/Section.vue'

const baseProps = {
  title: 'Skills',
  icon: 'i-lucide-wrench',
  empty: false,
  emptyMessage: 'No skills yet.',
  addLabel: 'Add skill',
  testid: 'section'
}

const jumpTarget = ref<string | null>(null)

const mountSection = (props = {}, mobile?: boolean) =>
  mountSuspended(ProfileSection, {
    props: { ...baseProps, ...props },
    slots: { default: '<p data-testid="body">Vue</p>' },
    global:
      mobile === undefined
        ? {}
        : {
            provide: {
              'profile-mobile-collapsible': ref(mobile),
              'profile-jump-target': jumpTarget
            }
          }
  })

describe('ProfileSection', () => {
  it('shows its content with no toggle when the page is not collapsing sections', async () => {
    const wrapper = await mountSection({ defaultOpen: false, count: 3 }, false)
    expect(wrapper.find('[aria-expanded]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="body"]').exists()).toBe(true)
    expect(wrapper.get('h2').text()).toBe('Skills · 3')
  })

  it('starts collapsed on mobile when asked to and opens from its header', async () => {
    const wrapper = await mountSection({ defaultOpen: false, count: 3 }, true)
    const header = wrapper.get('[role="button"]')
    expect(header.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[data-testid="body"]').exists()).toBe(false)
    expect(header.text()).toContain('Skills · 3')

    await header.trigger('click')
    expect(header.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('[data-testid="body"]').exists()).toBe(true)
  })

  it('opens when a jump link targets it', async () => {
    const wrapper = await mountSection({ defaultOpen: false }, true)
    jumpTarget.value = 'section'
    await nextTick()
    expect(wrapper.find('[data-testid="body"]').exists()).toBe(true)
    jumpTarget.value = null
  })

  it('starts open on mobile by default', async () => {
    const wrapper = await mountSection({}, true)
    expect(wrapper.get('[role="button"]').attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('[data-testid="body"]').exists()).toBe(true)
  })

  it('offers the add action in a single row when empty', async () => {
    const wrapper = await mountSection({ empty: true })
    const empty = wrapper.get('[data-testid="section-empty"]')
    expect(empty.text()).toContain('No skills yet.')
    await empty.get('[data-testid="section-add"]').trigger('click')
    expect(wrapper.emitted('add')).toHaveLength(1)
  })
})

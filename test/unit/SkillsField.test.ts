import { describe, expect, it } from 'vitest'
import { nextTick, reactive } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SkillsField from '~/components/listings/SkillsField.vue'
import NameCombobox from '~/components/listings/NameCombobox.vue'
import type { ListingSkill } from '~/composables/useListingForm'

describe('SkillsField', () => {
  it('adds a picked skill once, ignoring case', async () => {
    const skills = reactive<ListingSkill[]>([])
    const wrapper = await mountSuspended(SkillsField, { props: { modelValue: skills } })
    const combobox = wrapper.findComponent(NameCombobox)

    combobox.vm.$emit('update:modelValue', 'Vue')
    combobox.vm.$emit('update:modelValue', 'vue')
    await nextTick()

    expect(skills).toEqual([{ name: 'Vue', level: 3, isRequired: true }])
    expect(wrapper.findAll('[data-testid="skill-row"]')).toHaveLength(1)
  })
})

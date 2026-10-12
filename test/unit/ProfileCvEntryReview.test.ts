import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { reactive, ref } from 'vue'
import { USelect } from '#components'
import { flushPromises } from '@vue/test-utils'
import CvEntryReview from '~/components/profile/CvEntryReview.vue'
import { CV_ISSUES, createCvDraft, reviewCvSelection } from '~/utils/profileCvImport'
import { cvCandidate, cvExperience, cvProfile } from '../fixtures/profileCv'

describe('CV entry review controls', () => {
  it('requires manual entry selection, preserves target structure and limits bullet update choices to its parent', async () => {
    const profile = cvProfile()
    const draft = reactive(
      createCvDraft(
        cvCandidate({ experiences: [cvExperience({ startMonth: null, endMonth: null })] }),
        profile
      )
    )
    const entry = draft.entries.experiences[0]!
    const wrapper = await mountSuspended(CvEntryReview, {
      props: { modelValue: entry, kind: 'experiences', path: 'experiences[0]', profile },
      global: { provide: { [CV_ISSUES]: ref([]) } }
    })
    expect(entry.id).toBeUndefined()
    const select = (id: string) =>
      wrapper
        .findAllComponents(USelect)
        .find((component) => component.vm.$attrs['data-testid'] === id)!
    select('experiences[0]-action').vm.$emit('update:modelValue', 'update')
    await flushPromises()
    expect(entry.id).toBeUndefined()
    select('experiences[0]-target').vm.$emit('update:modelValue', 10)
    await flushPromises()
    expect(entry).toMatchObject({
      id: 10,
      startMonth: '2020-01-01',
      endMonth: '2022-01-01',
      location: { countryCode: 'NO', city: 'Oslo' },
      skillNames: ['Vue']
    })
    expect(wrapper.text()).toContain('Current saved values')
    select('experiences[0]-bullet-0-action').vm.$emit('update:modelValue', 'update')
    await flushPromises()
    const bullet = select('experiences[0]-bullet-0-target')
    expect(bullet.props('items')).toEqual([{ label: 'Existing bullet', value: 100 }])
    bullet.vm.$emit('update:modelValue', 100)
    await flushPromises()
    expect(reviewCvSelection(draft, profile).selection.experiences![0]!.bullets).toEqual([
      { id: 100, text: 'Incoming bullet' }
    ])
    select('experiences[0]-action').vm.$emit('update:modelValue', 'add')
    await flushPromises()
    expect(entry.id).toBeUndefined()
    expect(entry.bullets[0]).toMatchObject({ action: 'add', id: undefined })
    wrapper.unmount()
  })

  const mountEntry = async (
    kind: 'experiences' | 'educations',
    candidate: Parameters<typeof cvCandidate>[0],
    needsAttention = false
  ) => {
    const profile = cvProfile()
    const entry = reactive(createCvDraft(cvCandidate(candidate), profile).entries[kind][0]!)
    const wrapper = await mountSuspended(CvEntryReview, {
      props: { modelValue: entry, kind, path: `${kind}[0]`, profile, needsAttention },
      global: { provide: { [CV_ISSUES]: ref([]) } }
    })
    return { wrapper, entry }
  }

  it('summarizes a complete entry while collapsed and keeps edits after expanding', async () => {
    const { wrapper, entry } = await mountEntry('experiences', { experiences: [cvExperience()] })
    const details = wrapper.find('details')
    expect(details.attributes('open')).toBeUndefined()
    const header = wrapper.find('[data-testid="experiences[0]-header"]').text()
    expect(header).toContain('Acme · Lead')
    expect(header).toContain('2023')
    expect(wrapper.text()).not.toContain('Needs attention')
    await wrapper.setProps({ needsAttention: true })
    expect(wrapper.text()).toContain('Needs attention')
    expect(wrapper.find('details').attributes('open')).toBeUndefined()
    ;(details.element as HTMLDetailsElement).open = true
    await wrapper.find('[data-testid="experiences[0]-employer"]').setValue('Acme Labs')
    expect(entry.employer).toBe('Acme Labs')
    expect(wrapper.find('[data-testid="experiences[0]-header"]').text()).toContain('Acme Labs')
    wrapper.unmount()
  })

  it('names a title-only experience and starts an entry needing attention open', async () => {
    const { wrapper } = await mountEntry(
      'experiences',
      { experiences: [cvExperience({ employer: null })] },
      true
    )
    expect(wrapper.find('[data-testid="experiences[0]-header"]').text()).toContain('Lead')
    expect(wrapper.text()).not.toContain('Untitled entry')
    expect(wrapper.find('details').attributes('open')).toBeDefined()
    wrapper.unmount()
  })

  it('offers Update existing only when saved entries exist and mutes skipped entries', async () => {
    const { wrapper } = await mountEntry('educations', {
      educations: [
        {
          school: 'University',
          degree: 'BSc',
          field: null,
          startMonth: '2015-01-01',
          endMonth: '2018-01-01',
          location: null,
          bullets: []
        }
      ]
    })
    const action = wrapper
      .findAllComponents(USelect)
      .find((component) => component.vm.$attrs['data-testid'] === 'educations[0]-action')!
    expect(action.props('items')).toEqual([
      { label: 'Add new', value: 'add' },
      { label: 'Skip', value: 'skip' }
    ])
    action.vm.$emit('update:modelValue', 'skip')
    await flushPromises()
    expect(wrapper.find('details').exists()).toBe(false)
    expect(wrapper.find('[data-testid="educations[0]"]').classes()).toContain('bg-muted')
    expect(wrapper.text()).toContain('University')
    wrapper.unmount()
  })
})

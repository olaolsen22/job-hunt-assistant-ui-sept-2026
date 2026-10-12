import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MonthField from '~/components/app/MonthField.vue'
import { USelect, UInputNumber } from '#components'

const mountField = (modelValue: string | null) =>
  mountSuspended(MonthField, { props: { modelValue } })

type Field = Awaited<ReturnType<typeof mountField>>

// Drives the two controls through their events; the Nuxt UI inputs themselves are covered upstream.
const setParts = async (wrapper: Field, month?: number, year?: number) => {
  wrapper.findComponent(USelect).vm.$emit('update:modelValue', month)
  wrapper.findComponent(UInputNumber).vm.$emit('update:modelValue', year)
  await nextTick()
}

const lastEmit = (wrapper: Field) => wrapper.emitted('update:modelValue')?.at(-1)?.[0]

describe('MonthField', () => {
  it('emits the first of the month once month and year are both set', async () => {
    const wrapper = await mountField(null)
    await setParts(wrapper, 3, 2021)
    expect(lastEmit(wrapper)).toBe('2021-03-01')
  })

  it('emits null when the year is cleared', async () => {
    const wrapper = await mountField('2021-03-01')
    await setParts(wrapper, 3, undefined)
    expect(lastEmit(wrapper)).toBeNull()
  })

  it('reports a half-filled value as partial until both parts are set', async () => {
    const wrapper = await mountField('2021-03-01')
    await setParts(wrapper, 3, undefined)
    expect(wrapper.emitted('update:partial')?.at(-1)).toEqual([true])
    await setParts(wrapper, 3, 2022)
    expect(wrapper.emitted('update:partial')?.at(-1)).toEqual([false])
  })

  it('fills both parts from an initial value', async () => {
    const wrapper = await mountField('2021-03-01')
    expect(wrapper.findComponent(USelect).props('modelValue')).toBe(3)
    expect(wrapper.findComponent(UInputNumber).props('modelValue')).toBe(2021)
  })
})

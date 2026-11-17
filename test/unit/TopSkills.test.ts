import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { USelect } from '#components'
import TopSkills from '~/components/skills/TopSkills.vue'

type Vars = { since: string | null; requiredOnly: boolean }

const row = (
  id: number,
  name: string,
  listingCount: number,
  extra: Record<string, unknown> = {}
) => ({
  listingCount,
  skill: { id, name, profileLevel: null, category: null, ...extra }
})

let rows: unknown[] = []
let fail = false
const calls: Vars[] = []

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const { query, variables } = await readBody(event)
    if (!query.includes('query TopSkills')) return { data: {} }
    calls.push(variables)
    if (fail) return { data: null, errors: [{ message: 'boom' }] }
    return { data: { topSkills: rows } }
  }
})

const query = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const queryAll = (id: string) => [
  ...document.body.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)
]
const buttonWithText = (text: string) =>
  [...document.body.querySelectorAll<HTMLElement>('button')].find((b) =>
    b.textContent?.includes(text)
  )

const mounted: { unmount: () => void }[] = []
const mountCard = async (route = '/skills') => {
  const wrapper = await mountSuspended(TopSkills, { attachTo: document.body, route })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  rows = [
    row(1, 'TypeScript', 7, { profileLevel: 4, category: { name: 'Languages' } }),
    row(2, 'Kubernetes', 1)
  ]
  fail = false
  calls.length = 0
  clearNuxtData('top-skills')
})
afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  document.body.innerHTML = ''
})

describe('Top skills card', () => {
  it('lists skills with counts, profile badges and links to matching listings', async () => {
    await mountCard()
    await vi.waitFor(() => expect(queryAll('top-skills-row')).toHaveLength(2))
    const [ts, k8s] = queryAll('top-skills-row')

    expect(calls[0]).toEqual({ since: null, requiredOnly: false })
    expect(ts!.textContent).toContain('TypeScript')
    expect(ts!.textContent).toContain('Languages')
    expect(ts!.textContent).toContain('7 listings')
    expect(ts!.textContent).toContain('On profile')
    expect(ts!.textContent).not.toContain('Not on profile')
    expect(k8s!.textContent).toContain('1 listing')
    expect(k8s!.textContent).not.toContain('1 listings')
    expect(k8s!.textContent).toContain('Not on profile')
    expect(ts!.querySelector('a')!.getAttribute('href')).toBe('/listings?skill=TypeScript')
    expect(k8s!.querySelector('a')!.getAttribute('href')).toBe('/listings?skill=Kubernetes')
  })

  it('resends with requiredOnly and a since date, and keeps both in the URL', async () => {
    const wrapper = await mountCard('/skills?category=3')
    await vi.waitFor(() => expect(calls).toHaveLength(1))

    const toggle = query('top-skills-required')!
    ;(toggle.querySelector<HTMLElement>('[role="switch"]') ?? toggle).click()
    await vi.waitFor(() => expect(calls).toHaveLength(2))
    expect(calls[1]).toEqual({ since: null, requiredOnly: true })

    wrapper.findComponent(USelect).vm.$emit('update:modelValue', '30')
    await vi.waitFor(() => expect(calls).toHaveLength(3))
    expect(calls[2]!.requiredOnly).toBe(true)
    expect(calls[2]!.since).toBe(localDayStartIso(29))

    await vi.waitFor(() =>
      expect(useRouter().currentRoute.value.query).toEqual({
        category: '3',
        period: '30',
        required: '1'
      })
    )
  })

  it('reads the period and required filter from the URL', async () => {
    await mountCard('/skills?period=90&required=1')
    await vi.waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]).toEqual({ since: localDayStartIso(89), requiredOnly: true })
  })

  it('offers "Show all time" when a narrowed view is empty, and it resets both controls', async () => {
    rows = []
    await mountCard('/skills?period=30&required=1')
    await vi.waitFor(() => expect(query('top-skills-empty')).not.toBeNull())
    expect(query('top-skills-empty')!.textContent).toContain(
      'No required skills in listings from this period.'
    )
    expect(query('top-skills-empty')!.textContent).not.toContain('Add listing')

    buttonWithText('Show all time')!.click()
    await vi.waitFor(() => expect(calls).toHaveLength(2))
    expect(calls[1]).toEqual({ since: null, requiredOnly: false })
    await vi.waitFor(() => expect(useRouter().currentRoute.value.query).toEqual({}))
    await vi.waitFor(() =>
      expect(query('top-skills-empty')!.textContent).toContain('No skills yet')
    )
  })

  it('shows the first-use empty state with Add listing by default', async () => {
    rows = []
    await mountCard()
    await vi.waitFor(() => expect(query('top-skills-empty')).not.toBeNull())
    const empty = query('top-skills-empty')!
    expect(empty.textContent).toContain('No skills yet')
    expect(empty.querySelector('a')!.getAttribute('href')).toBe('/listings/add')
    expect(buttonWithText('Show all time')).toBeUndefined()
  })

  it('shows an error with Try again, which reloads', async () => {
    fail = true
    await mountCard()
    await vi.waitFor(() => expect(buttonWithText('Try again')).toBeDefined())
    expect(queryAll('top-skills-row')).toHaveLength(0)

    fail = false
    buttonWithText('Try again')!.click()
    await vi.waitFor(() => expect(queryAll('top-skills-row')).toHaveLength(2))
    expect(calls).toHaveLength(2)
    expect(buttonWithText('Try again')).toBeUndefined()
  })

  it('hides rows after the fifth on small screens until the toggle is pressed', async () => {
    rows = Array.from({ length: 8 }, (_, i) => row(i + 1, `Skill ${i + 1}`, 10 - i))
    await mountCard()
    await vi.waitFor(() => expect(queryAll('top-skills-row')).toHaveLength(8))
    const hidden = () =>
      queryAll('top-skills-row').map((r) => r.classList.contains('max-xl:hidden'))

    expect(hidden()).toEqual([false, false, false, false, false, true, true, true])
    expect(query('top-skills-toggle')!.textContent).toContain('Show top 8')

    query('top-skills-toggle')!.click()
    await flushPromises()
    expect(hidden()).toEqual(Array(8).fill(false))
    expect(query('top-skills-toggle')!.textContent).toContain('Show top 5')

    query('top-skills-toggle')!.click()
    await flushPromises()
    expect(hidden()).toEqual([false, false, false, false, false, true, true, true])
  })

  it('has no toggle with five rows or fewer', async () => {
    await mountCard()
    await vi.waitFor(() => expect(queryAll('top-skills-row')).toHaveLength(2))
    expect(query('top-skills-toggle')).toBeNull()
  })
})

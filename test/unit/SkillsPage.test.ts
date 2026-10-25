import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { USelect } from '#components'
import SkillsPage from '~/pages/skills.vue'

type Body = {
  query: string
  variables?: {
    input?: { id?: number; position?: number; categoryId?: number | null }
    operations?: unknown
  }
}

const category = (id: number, name: string, sortOrder: number, skillCount = 1) => ({
  id,
  name,
  description: `${name} description`,
  sortOrder,
  skillCount,
  translations: []
})
const skill = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  categoryId: null,
  listingCount: 0,
  profileLevel: null,
  translations: [],
  ...extra
})

let categories = [category(1, 'Languages', 0), category(2, 'Frameworks', 1)]
const skills = [
  skill(10, 'TypeScript', { categoryId: 1, listingCount: 4, profileLevel: 4 }),
  skill(11, 'Vue', { categoryId: 2, listingCount: 2 }),
  skill(12, 'Vue.js', { listingCount: 1 }),
  skill(13, 'Fortran')
]
let deleteErrors: unknown[] | null = null
const calls: Body[] = []
const ok = { errors: null }

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const body = (await readBody(event)) as Body
    calls.push(body)
    const q = body.query
    if (q.includes('query SkillCategories'))
      return { data: { skillCategories: { nodes: categories } } }
    if (q.includes('query SkillsCatalog'))
      return {
        data: { skills: { nodes: skills, pageInfo: { hasNextPage: false, endCursor: null } } }
      }
    if (q.includes('mutation MoveSkillCategory')) {
      const { id, position } = body.variables!.input
      const moved = categories.filter((c) => c.id !== id)
      moved.splice(
        position,
        0,
        categories.find((c) => c.id === id)!
      )
      categories = moved.map((c, i) => ({ ...c, sortOrder: i }))
      return { data: { moveSkillCategory: { skillCategories: categories, errors: null } } }
    }
    if (q.includes('mutation UpdateSkillCategory')) return { data: { updateSkillCategory: ok } }
    if (q.includes('mutation SetSkillCategory('))
      return {
        data: {
          setSkillCategory: {
            skill: { categoryId: body.variables!.input.categoryId },
            errors: null
          }
        }
      }
    if (q.includes('mutation DeleteSkill('))
      return { data: { deleteSkill: { errors: deleteErrors } } }
    if (q.includes('mutation CleanUpSkills'))
      return { data: { cleanUpSkills: { skills: [{ id: 10 }], errors: null } } }
    return { data: {} }
  }
})

const query = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const queryAll = (id: string) => [
  ...document.body.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)
]
const click = async (el: HTMLElement | null) => {
  el!.click()
  await flushPromises()
}
const callsOf = (name: string) => calls.filter((c) => c.query.includes(name))

const mounted: { unmount: () => void }[] = []
const mountPage = async () => {
  const wrapper = await mountSuspended(SkillsPage, { attachTo: document.body })
  mounted.push(wrapper)
  await vi.waitFor(() => expect(queryAll('skills-row')).toHaveLength(skills.length))
  return wrapper
}
// Each skill row's category select (the page has no other USelect outside a modal).
const rowSelect = (wrapper: Awaited<ReturnType<typeof mountPage>>, i: number) =>
  wrapper.findAllComponents(USelect)[i]!

beforeEach(() => {
  categories = [category(1, 'Languages', 0), category(2, 'Frameworks', 1)]
  deleteErrors = null
  calls.length = 0
  clearNuxtData()
})
afterEach(() => mounted.splice(0).forEach((w) => w.unmount()))

describe('Skills page', () => {
  it('moves a category down and shows the order the API returns', async () => {
    await mountPage()
    // The wide-screen column and the slideover share the component; the column is rendered first.
    await click(queryAll('skill-category-down')[0]!)

    expect(callsOf('mutation MoveSkillCategory')[0]!.variables!.input).toEqual({
      id: 1,
      position: 1
    })
    await vi.waitFor(() =>
      expect(queryAll('skill-category').map((r) => r.textContent)).toEqual([
        expect.stringContaining('Frameworks'),
        expect.stringContaining('Languages')
      ])
    )
  })

  it('sends the description again when a category is renamed', async () => {
    await mountPage()
    await click(queryAll('skill-category-edit')[0]!)
    const name = query('category-name')!.querySelector('input') ?? query('category-name')!
    ;(name as HTMLInputElement).value = 'Programming languages'
    name.dispatchEvent(new Event('input'))
    await flushPromises()
    await click(query('form-modal-save'))

    await vi.waitFor(() => expect(callsOf('mutation UpdateSkillCategory')).toHaveLength(1))
    expect(callsOf('mutation UpdateSkillCategory')[0]!.variables!.input).toEqual({
      id: 1,
      name: 'Programming languages',
      description: 'Languages description'
    })
  })

  it('filters to uncategorized skills', async () => {
    await mountPage()
    await click(query('skill-filter-none'))

    expect(queryAll('skills-row').map((r) => r.textContent)).toEqual([
      expect.stringContaining('Vue.js'),
      expect.stringContaining('Fortran')
    ])
  })

  it('clears a category by sending null', async () => {
    const wrapper = await mountPage()
    rowSelect(wrapper, 0).vm.$emit('update:modelValue', 'NONE')
    await flushPromises()

    expect(callsOf('mutation SetSkillCategory(')[0]!.variables!.input).toEqual({
      skillId: 10,
      categoryId: null
    })
  })

  it('sets one category on every ticked skill and clears the ticks', async () => {
    const wrapper = await mountPage()
    // Alphabetical as loaded: TypeScript, Vue, Vue.js, Fortran → tick Vue and Vue.js.
    const boxes = queryAll('skills-select')
    await click(boxes[1]!.querySelector('button') ?? boxes[1]!)
    await click(boxes[2]!.querySelector('button') ?? boxes[2]!)
    await click(query('skills-set-category'))
    await vi.waitFor(() => expect(query('skills-bulk-category')).not.toBeNull())
    const picker = wrapper
      .findAllComponents(USelect)
      .find((c) => c.props('placeholder') === 'Choose a category')!
    picker.vm.$emit('update:modelValue', 2)
    await flushPromises()
    await click(query('confirm-modal-confirm'))

    await vi.waitFor(() => expect(callsOf('mutation SetSkillCategory(')).toHaveLength(2))
    expect(callsOf('mutation SetSkillCategory(').map((c) => c.variables!.input)).toEqual([
      { skillId: 11, categoryId: 2 },
      { skillId: 12, categoryId: 2 }
    ])
    await vi.waitFor(() => expect(query('skills-selection')).toBeNull())
  })

  it('merges ticked skills into the one kept, under the chosen name', async () => {
    await mountPage()
    // Alphabetical as loaded: TypeScript, Vue, Vue.js, Fortran → tick Vue and Vue.js.
    const boxes = queryAll('skills-select')
    await click(boxes[1]!.querySelector('button') ?? boxes[1]!)
    await click(boxes[2]!.querySelector('button') ?? boxes[2]!)
    await click(query('skills-merge'))
    await vi.waitFor(() => expect(query('merge-name')).not.toBeNull(), { timeout: 5000 })
    await click(query('form-modal-save'))

    await vi.waitFor(() => expect(callsOf('mutation CleanUpSkills')).toHaveLength(1))
    // Vue is used in more listings, so it is the one kept and goes first.
    expect(callsOf('mutation CleanUpSkills')[0]!.variables!.operations).toEqual([
      { skillIds: [11, 12], names: ['Vue'] }
    ])
  })

  it('warns that a rename onto an existing name merges', async () => {
    await mountPage()
    // Vue.js (row 3) has no profile level and is used once, so its menu has Rename first.
    await click(queryAll('skills-actions')[2]!)
    const rename = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (el) => el.textContent?.includes('Rename')
    )
    await click(rename!)
    // The modal's code loads on its first open, which takes a while under a full test run.
    await vi.waitFor(() => expect(query('rename-name')).not.toBeNull(), { timeout: 5000 })
    const input = query('rename-name')!.querySelector('input') ?? query('rename-name')!
    ;(input as HTMLInputElement).value = 'vue'
    input.dispatchEvent(new Event('input'))
    await flushPromises()

    expect(query('form-modal-save')!.textContent).toContain('Merge into Vue')
  })

  it('offers a merge when the API says a skill is in use', async () => {
    deleteErrors = [{ __typename: 'SkillInUseError', message: 'Fortran is tagged on an entry.' }]
    await mountPage()
    await click(queryAll('skills-actions')[3]!)
    const remove = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (el) => el.textContent?.includes('Delete')
    )
    await click(remove!)
    await click(query('confirm-modal-confirm'))

    await vi.waitFor(() =>
      expect(query('confirm-modal-confirm')!.textContent).toContain('Merge instead')
    )
    expect(document.body.textContent).toContain('Fortran is tagged on an entry.')
  })
})

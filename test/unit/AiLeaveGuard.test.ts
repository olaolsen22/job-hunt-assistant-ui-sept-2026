import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import type { VueWrapper } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { useAiLeaveGuard } from '~/composables/useLeaveGuard'
import { useAiInFlight } from '~/composables/useAiRequest'

registerEndpoint('/api/auth/me', () => ({ id: '1', email: 'owner@example.com', role: 'Owner' }))

const mounted: VueWrapper[] = []
afterEach(() => {
  useAiInFlight().value = 0
  mounted.splice(0).forEach((w) => w.unmount())
})

// The layout's guard on its own: no page is rendered, only the route changes.
const mountGuard = async () => {
  let guard!: ReturnType<typeof useAiLeaveGuard>
  const wrapper = await mountSuspended(
    defineComponent({
      setup: () => {
        guard = useAiLeaveGuard()
        return () => h('div')
      }
    }),
    { route: '/listings' }
  )
  mounted.push(wrapper)
  return guard
}

describe('AI leave guard', () => {
  it('asks before leaving while a built-in AI request runs, and leaves on confirm', async () => {
    const guard = await mountGuard()
    const router = useRouter()
    useAiInFlight().value = 1

    await router.push('/companies')
    expect(router.currentRoute.value.path).toBe('/listings')
    expect(guard.open.value).toBe(true)

    await guard.leave()
    expect(guard.open.value).toBe(false)
    expect(router.currentRoute.value.path).toBe('/companies')
  })

  it('lets query-only changes and navigation with no AI request through', async () => {
    const guard = await mountGuard()
    const router = useRouter()
    useAiInFlight().value = 1

    await router.push('/listings?search=dev')
    expect(router.currentRoute.value.fullPath).toBe('/listings?search=dev')
    expect(guard.open.value).toBe(false)

    useAiInFlight().value = 0
    await router.push('/companies')
    expect(router.currentRoute.value.path).toBe('/companies')
    expect(guard.open.value).toBe(false)
  })
})

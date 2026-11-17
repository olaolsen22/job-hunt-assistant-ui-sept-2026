import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { formatBrowserTitle } from '~/utils/browserTitle'
import { useListingTitle } from '~/composables/useListingTitle'

const { useHead } = vi.hoisted(() => ({ useHead: vi.fn() }))
mockNuxtImport('useHead', () => useHead)

describe('browser titles', () => {
  it('uses the short app name globally', () => {
    expect(formatBrowserTitle()).toBe('JH')
    expect(formatBrowserTitle('Dashboard')).toBe('JH - Dashboard')
  })

  it('updates listing identity and section reactively, including loading', () => {
    const listing = ref<{ title: string; company: { name: string } } | null>(null)
    const section = ref('')
    useListingTitle(listing, section)
    const title = useHead.mock.lastCall![0].title
    expect(formatBrowserTitle(title.value)).toBe('JH - Listing')
    listing.value = { title: 'Software Developer', company: { name: 'Company ABC' } }
    expect(formatBrowserTitle(title.value)).toBe('JH - Software Developer - Company ABC')
    section.value = 'Analyze'
    expect(formatBrowserTitle(title.value)).toBe('JH - Analyze - Software Developer - Company ABC')
    listing.value.title = 'Senior Developer'
    expect(title.value).toBe('Analyze - Senior Developer - Company ABC')
    section.value = 'Edit'
    expect(title.value).toBe('Edit - Senior Developer - Company ABC')
  })
})

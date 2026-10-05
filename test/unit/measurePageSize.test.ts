import { afterEach, describe, expect, it, vi } from 'vitest'
import { measurePageSize } from '~/composables/useListingsList'

// Fakes the three browser inputs the measurement reads.
const measure = (opts: { tablet: boolean; columns: number; innerHeight: number; top: number }) => {
  vi.stubGlobal('matchMedia', () => ({ matches: opts.tablet }))
  vi.stubGlobal('innerHeight', opts.innerHeight)
  const grid = document.createElement('div')
  grid.getBoundingClientRect = () => ({ top: opts.top }) as DOMRect
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    gridTemplateColumns: Array(opts.columns).fill('400px').join(' ')
  } as CSSStyleDeclaration)
  return measurePageSize(grid)
}

describe('measurePageSize', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fills the height with rows x columns from md up, 5 on phones', () => {
    const base = { tablet: true, innerHeight: 800, top: 200 }
    expect(measure({ ...base, columns: 2 })).toBe(4) // landscape: 2 rows x 2
    expect(measure({ ...base, columns: 1, innerHeight: 1100 })).toBe(4) // portrait: 4 rows x 1
    expect(measure({ ...base, columns: 2, tablet: false })).toBe(5)
  })
})

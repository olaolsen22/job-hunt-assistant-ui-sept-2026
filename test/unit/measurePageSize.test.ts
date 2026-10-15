import { afterEach, describe, expect, it, vi } from 'vitest'
import { measurePageSize } from '~/composables/useListingsList'

// Fakes the three browser inputs the measurement reads.
const measure = (
  opts: { tablet: boolean; columns: number; innerHeight: number; top: number },
  ...size: [itemHeight?: number, gap?: number]
) => {
  vi.stubGlobal('matchMedia', () => ({ matches: opts.tablet }))
  vi.stubGlobal('innerHeight', opts.innerHeight)
  const grid = document.createElement('div')
  grid.getBoundingClientRect = () => ({ top: opts.top }) as DOMRect
  // A flex list resolves to "none", which counts as one column.
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    gridTemplateColumns: opts.columns > 1 ? Array(opts.columns).fill('400px').join(' ') : 'none'
  } as CSSStyleDeclaration)
  return measurePageSize(grid, ...size)
}

describe('measurePageSize', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fills the height with listing rows from md up, 5 on phones', () => {
    const base = { tablet: true, columns: 1, innerHeight: 800, top: 200 }
    expect(measure(base)).toBe(6)
    expect(measure({ ...base, innerHeight: 1100 })).toBe(10)
    expect(measure({ ...base, innerHeight: 2000 })).toBe(12)
    expect(measure({ ...base, tablet: false })).toBe(5)
  })

  it('multiplies rows by columns for a card grid', () => {
    expect(measure({ tablet: true, columns: 2, innerHeight: 800, top: 200 }, 168, 16)).toBe(4)
  })
})

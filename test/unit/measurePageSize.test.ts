import { afterEach, describe, expect, it, vi } from 'vitest'
import { measurePageSize } from '~/composables/useListingsList'

// Fakes the three browser inputs the measurement reads.
const measure = (
  opts: {
    tablet: boolean
    columns: number
    innerHeight: number
    top: number
    split?: boolean
    table?: boolean
  },
  ...size: [itemHeight?: number, gap?: number]
) => {
  vi.stubGlobal('matchMedia', () => ({ matches: opts.tablet }))
  vi.stubGlobal('innerHeight', opts.innerHeight)
  const grid = document.createElement('div')
  grid.getBoundingClientRect = () => ({ top: opts.top }) as DOMRect
  const layout = document.createElement('div')
  layout.dataset.testid = 'listings-columns'
  layout.append(grid)
  if (opts.table) {
    grid.innerHTML = '<table><thead></thead></table>'
    grid.querySelector('thead')!.getBoundingClientRect = () => ({ height: 40 }) as DOMRect
  }
  // A flex list resolves to "none", which counts as one column.
  vi.spyOn(window, 'getComputedStyle').mockImplementation(
    (element) =>
      ({
        gridTemplateColumns:
          element === layout
            ? opts.split
              ? '384px 900px'
              : '900px'
            : opts.columns > 1
              ? Array(opts.columns).fill('400px').join(' ')
              : 'none'
      }) as CSSStyleDeclaration
  )
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

  it('uses the results height in the split layout without counting the filter sidebar as rows', () => {
    const base = { tablet: true, columns: 1, innerHeight: 1000, top: 140, table: true }
    expect(measure({ ...base, split: true })).toBe(10)
    expect(measure({ ...base, split: false, top: 460 })).toBe(5)
    // A short display still has a usable page, and a tall display is bounded.
    expect(measure({ ...base, split: true, innerHeight: 400 })).toBe(2)
    expect(measure({ ...base, split: true, innerHeight: 4000 })).toBe(24)
    expect(measure({ ...base, tablet: false })).toBe(5)
  })

  it('fills a tall desktop table with its current 72px rows', () => {
    expect(
      measure({
        tablet: true,
        columns: 1,
        innerHeight: 1326,
        top: 155,
        split: true,
        table: true
      })
    ).toBe(14)
  })

  it('multiplies rows by columns for a card grid', () => {
    expect(measure({ tablet: true, columns: 2, innerHeight: 800, top: 200 }, 168, 16)).toBe(4)
  })
})

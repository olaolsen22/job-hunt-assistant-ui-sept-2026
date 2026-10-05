import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import Dates from '~/components/listings/Dates.vue'

// Local YYYY-MM-DD, `days` from today (sv-SE formats as ISO).
const inDays = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('sv-SE')
}

const deadline = async (deadlineType: 'ASAP' | 'UNSPECIFIED', dueOn: string) => {
  const wrapper = await mountSuspended(Dates, {
    props: { listing: { postedOn: inDays(-3), deadlineType, deadlineOn: null, dueOn } }
  })
  return wrapper.get('[data-testid="listing-deadline"]').text()
}

describe('Dates', () => {
  it('shows the server due date for ASAP listings', async () => {
    expect(await deadline('ASAP', inDays(6))).toContain('ASAP, due ~')
  })

  it('shows a due date for listings without a stated deadline', async () => {
    expect(await deadline('UNSPECIFIED', inDays(20))).toContain('Not stated, due ~')
  })

  it('marks an expired ASAP listing as likely filled', async () => {
    expect(await deadline('ASAP', inDays(-1))).toContain('ASAP, likely filled')
  })
})

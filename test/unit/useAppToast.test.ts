import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppToast } from '~/composables/useAppToast'

const toasts = () => useToast().toasts.value
const settle = () => vi.waitFor(() => expect(toasts().length).toBeGreaterThan(0))

describe('useAppToast', () => {
  beforeEach(() => useToast().clear())

  it('gives every kind its own color and icon, so nothing falls back to green', async () => {
    const notify = useAppToast()
    notify.success('Saved')
    notify.error('Failed')
    notify.warning('Save first')
    notify.info('Nothing changed')
    await vi.waitFor(() => expect(toasts()).toHaveLength(4))
    expect(toasts().map((t) => [t.title, t.color, t.icon, t.duration])).toEqual([
      ['Saved', 'success', 'i-lucide-circle-check', 4000],
      ['Failed', 'error', 'i-lucide-circle-alert', 8000],
      ['Save first', 'warning', 'i-lucide-triangle-alert', 8000],
      ['Nothing changed', 'neutral', 'i-lucide-info', 5000]
    ])
  })

  it('offers Undo as a neutral 8 s toast with the standard action style', async () => {
    const onUndo = vi.fn()
    useAppToast().undoable('Removed Acme', onUndo, { icon: 'i-lucide-trash-2' })
    await settle()
    const [toast] = toasts()
    expect(toast).toMatchObject({ color: 'neutral', icon: 'i-lucide-trash-2', duration: 8000 })
    expect(toast!.actions).toEqual([
      expect.objectContaining({ label: 'Undo', color: 'neutral', variant: 'outline', size: 'md' })
    ])
    toast!.actions![0]!.onClick!(new MouseEvent('click'))
    expect(onUndo).toHaveBeenCalledOnce()
  })

  it('replaces a repeated message instead of stacking a copy', async () => {
    const notify = useAppToast()
    notify.error('Something went wrong')
    await settle()
    notify.error('Something went wrong')
    await new Promise((r) => setTimeout(r, 20))
    expect(toasts().filter((t) => t.title === 'Something went wrong')).toHaveLength(1)
  })
})

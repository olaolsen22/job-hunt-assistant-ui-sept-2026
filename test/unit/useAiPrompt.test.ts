import { describe, expect, it, vi } from 'vitest'
import { useAiPrompt } from '~/composables/useAiPrompt'

describe('useAiPrompt', () => {
  it('shows why the prompt failed to load and clears it after a successful retry', async () => {
    const fetchInstructions = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('Do the thing')
    const prompt = useAiPrompt(fetchInstructions)

    await prompt.loadPrompt()
    expect(prompt.promptError.value).toContain('offline')
    expect(prompt.instructions.value).toBe('')

    await prompt.loadPrompt()
    expect(prompt.promptError.value).toBe('')
    expect(prompt.instructions.value).toBe('Do the thing')
  })

  it('copies the transformed prompt and reports a refused clipboard write', async () => {
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error())
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const prompt = useAiPrompt(
      async () => 'Base',
      (text) => `${text} + notes`
    )
    await prompt.loadPrompt()

    await prompt.copyPrompt()
    expect(writeText).toHaveBeenCalledWith('Base + notes')
    expect(prompt.copied.value).toBe(true)

    expect(await prompt.copyPrompt()).toBe(false)
    expect(prompt.promptError.value).toContain('Could not copy')
    vi.unstubAllGlobals()
  })
})

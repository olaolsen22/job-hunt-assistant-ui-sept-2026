import { ERROR_MESSAGES } from '~/constants/errorMessages'

// The "use your own AI" prompt: fetched once, shown, and copied. Call loadPrompt() before the copy
// button is usable: browsers can refuse a clipboard write that follows an await.
// transform: adds something the prompt query can't take (e.g. the cover letter's unsaved notes).
export const useAiPrompt = (
  fetchInstructions: () => Promise<string>,
  transform?: (instructions: string) => string
) => {
  const raw = ref('')
  const instructions = computed(() => (raw.value && transform ? transform(raw.value) : raw.value))
  const promptLoading = ref(false)
  const promptError = ref('')
  const copied = ref(false)

  const loadPrompt = async () => {
    promptLoading.value = true
    promptError.value = ''
    try {
      raw.value = await fetchInstructions()
    } catch (e) {
      promptError.value = `${ERROR_MESSAGES.generic} (${errorDetail(e)})`
    } finally {
      promptLoading.value = false
    }
  }

  // Returns whether it worked, for callers without a spot to show promptError.
  const copyText = async (text: string) => {
    promptError.value = ''
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => (copied.value = false), 1500)
      return true
    } catch {
      promptError.value = 'Could not copy the prompt. Copy it from “View prompt” below.'
      return false
    }
  }
  const copyPrompt = () => copyText(instructions.value)

  return { instructions, promptLoading, promptError, copied, loadPrompt, copyText, copyPrompt }
}

// copyPrompt is optional for prompts that are copied with input added (the ad parse).
type Prompt = ReturnType<typeof useAiPrompt>
export type AiPromptState = Pick<
  Prompt,
  'instructions' | 'promptLoading' | 'promptError' | 'copied' | 'loadPrompt'
> &
  Partial<Pick<Prompt, 'copyPrompt'>>

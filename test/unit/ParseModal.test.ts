import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, readBody } from 'h3'
import ParseModal from '~/components/listings/ParseModal.vue'
import { llmModels, unknownModelError } from '../fixtures/llmModels'

const mountOpen = (props: { listingId?: number; url?: string }) =>
  mountSuspended(ParseModal, { props: { open: true, ...props }, attachTo: document.body })

const click = async (testid: string) => {
  document.body.querySelector<HTMLElement>(`[data-testid="${testid}"]`)?.click()
  await flushPromises()
}

// One endpoint for the whole file: a later registerEndpoint on the same path doesn't replace it.
let urlParseResponse: object = {}
let builtInResponse: object = {}
let sentUrl: unknown
let sentModels: unknown[] = []
let sentRequestIds: unknown[] = []
// Simulates a request that got no answer (gateway error) for the built-in parse.
let builtInFails = false
// A GraphQL-level error for the link parse, which the gql helper throws.
let urlGraphqlError = ''
let modelLoads = 0
// The prompt query fails until it is switched back.
let promptFails = false
registerEndpoint('/graphql', {
  method: 'POST',
  handler: async (event) => {
    const { query, variables } = await readBody(event)
    if (query.includes('ParseUrl')) sentUrl = variables.url
    if (query.includes('mutation Parse')) {
      sentModels.push(variables.model)
      sentRequestIds.push(variables.requestId)
    }
    if (urlGraphqlError && query.includes('mutation ParseListingFromUrl'))
      return { errors: [{ message: urlGraphqlError }] }
    if (builtInFails && query.includes('mutation ParseListing'))
      throw createError({ statusCode: 502 })
    if (query.includes('query LlmModels')) modelLoads++
    if (promptFails && query.includes('query ListingParsePrompt'))
      return { errors: [{ message: 'Prompt unavailable' }] }
    return {
      data: {
        // Same response for both link parses.
        parseListingFromUrl: urlParseResponse,
        parseUrl: urlParseResponse,
        parseListing: builtInResponse,
        prompt: { instructions: 'x' },
        llmModels: llmModels(),
        llmUsageToday: {
          model: 'fast',
          requests: 3,
          inputTokens: 1200,
          outputTokens: 340,
          requestsLimit: 50,
          remainingRequests: 47,
          resetsAt: '2026-10-08T00:00:00Z'
        }
      }
    }
  }
})
const respondToUrlParse = (payload: object) => (urlParseResponse = payload)
const respondToBuiltInParse = (payload: object) => (builtInResponse = payload)

const typeAd = async (text: string) => {
  await flushPromises()
  const ad = document.body.querySelector<HTMLTextAreaElement>('[data-testid="parse-ad"]')!
  ad.value = text
  ad.dispatchEvent(new Event('input'))
  await flushPromises()
}

describe('ParseModal', () => {
  it('loads the prompt when it is mounted already open', async () => {
    const wrapper = await mountSuspended(ParseModal, {
      props: { open: true },
      attachTo: document.body
    })
    // The copy button lives on the Your own AI tab.
    wrapper.vm.tab = 'own'
    await flushPromises()

    const copy = document.body.querySelector('[data-testid="parse-copy-prompt"]')
    expect(copy?.querySelector('.animate-spin, [class*="loader"]')).toBeNull()
    wrapper.unmount()
  })

  it('copies a prompt with the ad link when the own-AI source is Ad link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const wrapper = await mountOpen({ url: 'https://example.com/job' })
    wrapper.vm.tab = 'own'
    wrapper.vm.aiSource = 'link'
    await flushPromises()

    await click('parse-copy-prompt')

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('https://example.com/job'))
    expect(document.body.querySelector('[data-testid="parse-ad"]')).toBeNull()
    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('shows a failed prompt load on Your own AI and loads it again on retry', async () => {
    promptFails = true
    const wrapper = await mountOpen({})
    wrapper.vm.tab = 'own'
    await flushPromises()
    const error = () => document.body.querySelector('[data-testid="parse-prompt-error"]')
    await vi.waitFor(() => expect(error()?.textContent).toContain('Prompt unavailable'))
    expect(
      document.body.querySelector<HTMLButtonElement>('[data-testid="parse-copy-prompt"]')!.disabled
    ).toBe(true)

    promptFails = false
    error()!.querySelector('button')!.click()
    await vi.waitFor(() => expect(error()).toBeNull())
    expect(document.body.textContent).toContain('View prompt / copy manually')
    wrapper.unmount()
  })

  it('fills the form from your own AI and opens on it next time', async () => {
    const wrapper = await mountOpen({ listingId: 1 })
    wrapper.vm.tab = 'own'
    await flushPromises()
    const json = document.body.querySelector<HTMLTextAreaElement>('[data-testid="parse-json"]')!
    json.value = '{"title":"Developer"}'
    json.dispatchEvent(new Event('input'))
    await flushPromises()
    await click('parse-apply')
    expect(wrapper.emitted('apply')?.[0]).toEqual([{ title: 'Developer' }])
    wrapper.unmount()

    const again = await mountOpen({ listingId: 1 })
    await flushPromises()
    expect(again.vm.tab).toBe('own')
    again.unmount()
    document.cookie = 'ai-method=; Max-Age=0; path=/'
  })

  it('emits the parsed draft from the saved listing and closes', async () => {
    respondToUrlParse({
      parseJob: { status: 'SUCCEEDED', result: '{"title":"Dev"}', error: null },
      errors: null
    })
    const wrapper = await mountOpen({ listingId: 7 })
    await click('parse-url')

    await vi.waitFor(() => expect(wrapper.emitted('apply')?.[0]).toEqual([{ title: 'Dev' }]))
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
    wrapper.unmount()
  })

  it('parses a link pasted in the modal and hands it back with the draft', async () => {
    respondToUrlParse({
      parseJob: { status: 'SUCCEEDED', result: '{"title":"Dev"}', error: null },
      errors: null
    })
    const wrapper = await mountOpen({ url: '' })
    const parse = () => document.body.querySelector<HTMLButtonElement>('[data-testid="parse-url"]')!
    expect(parse().disabled).toBe(true)

    const input = document.body.querySelector<HTMLInputElement>('[data-testid="parse-link"]')!
    input.value = 'https://jobs.example/1'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    await click('parse-url')

    await vi.waitFor(() =>
      expect(wrapper.emitted('apply')?.[0]).toEqual([{ title: 'Dev' }, 'https://jobs.example/1'])
    )
    expect(sentUrl).toBe('https://jobs.example/1')
    wrapper.unmount()
  })

  it('offers pasting the ad when a new link cannot be read', async () => {
    respondToUrlParse({
      parseJob: null,
      errors: [{ __typename: 'InvalidParseRequestError', message: 'Page unreadable' }]
    })
    const wrapper = await mountOpen({ url: 'https://blocked.example/1' })
    await click('parse-url')
    await vi.waitFor(() =>
      expect(document.body.querySelector('[data-testid="parse-url-error"]')?.textContent).toContain(
        'Page unreadable'
      )
    )

    await click('parse-paste-instead')
    expect(document.body.querySelector('[data-testid="parse-ad"]')).not.toBeNull()
    wrapper.unmount()
  })

  it('shows why the page could not be parsed and keeps the modal open', async () => {
    respondToUrlParse({
      parseJob: null,
      errors: [{ __typename: 'InvalidParseRequestError', message: 'Page unreadable' }]
    })
    const wrapper = await mountOpen({ listingId: 7 })
    await click('parse-url')

    await vi.waitFor(() =>
      expect(document.body.querySelector('[data-testid="parse-url-error"]')?.textContent).toContain(
        'Page unreadable'
      )
    )
    expect(wrapper.emitted('apply')).toBeUndefined()
    wrapper.unmount()
  })

  it('shows a built-in parse error in the tab and keeps the pasted ad', async () => {
    respondToBuiltInParse({
      parseJob: null,
      errors: [{ __typename: 'InvalidParseRequestError', message: 'Ad too short' }]
    })
    const wrapper = await mountOpen({})
    wrapper.vm.source = 'text'
    await flushPromises()
    const ad = document.body.querySelector<HTMLTextAreaElement>('[data-testid="parse-ad"]')!
    ad.value = 'Some ad'
    ad.dispatchEvent(new Event('input'))
    await flushPromises()
    await click('parse-builtin-run')

    await vi.waitFor(() =>
      expect(
        document.body.querySelector('[data-testid="parse-builtin-error"]')?.textContent
      ).toContain('Ad too short')
    )
    expect(wrapper.vm.source).toBe('text')
    expect(
      document.body.querySelector<HTMLTextAreaElement>('[data-testid="parse-ad"]')!.value
    ).toBe('Some ad')
    wrapper.unmount()
  })

  it('offers no model choice and sends no model', async () => {
    respondToBuiltInParse({
      parseJob: { status: 'FAILED', result: null, error: 'x' },
      errors: null
    })
    sentModels = []
    const wrapper = await mountOpen({})
    wrapper.vm.source = 'text'
    await typeAd('Some ad')
    await click('parse-builtin-run')

    await vi.waitFor(() => expect(sentModels).toEqual([undefined]))
    expect(document.body.querySelector('select, [role="combobox"]')).toBeNull()
    wrapper.unmount()
  })

  it('shows an unknown default model and refetches the models', async () => {
    respondToBuiltInParse({ parseJob: null, errors: [unknownModelError] })
    const wrapper = await mountOpen({})
    wrapper.vm.source = 'text'
    await vi.waitFor(() => expect(modelLoads).toBeGreaterThan(0))
    const loads = modelLoads
    await typeAd('Some ad')
    await click('parse-builtin-run')

    await vi.waitFor(() =>
      expect(
        document.body.querySelector('[data-testid="parse-builtin-error"]')?.textContent
      ).toContain('isn’t available')
    )
    expect(modelLoads).toBe(loads + 1)
    expect(
      document.body.querySelector<HTMLTextAreaElement>('[data-testid="parse-ad"]')!.value
    ).toBe('Some ad')
    wrapper.unmount()
  })

  it('warns about AI cost on From link and Paste ad, not on Your own AI', async () => {
    const wrapper = await mountOpen({ listingId: 7 })
    const notice = () => document.body.querySelector('[data-testid="parse-cost-notice"]')

    expect(notice()).not.toBeNull()
    const line = (id: string) => document.body.querySelector(`[data-testid="${id}"]`)?.textContent
    await vi.waitFor(() => expect(line('ai-usage-tokens')).toContain('1,200 tokens in'))
    expect(line('ai-usage-tokens')).toContain('340 out')
    await vi.waitFor(() => expect(line('ai-notice-model')).toBe('Fast'))
    // The model is named once above, so the usage line leaves it out.
    expect(line('ai-usage-requests')?.replace(/\s+/g, ' ').trim()).toBe('3 of 50 requests')
    expect(
      document.body.querySelector('[data-testid="parse-cost-notice"] a')?.getAttribute('href')
    ).toBe('/settings')
    wrapper.vm.source = 'text'
    await flushPromises()
    expect(notice()).not.toBeNull()
    wrapper.vm.tab = 'own'
    await flushPromises()
    expect(notice()).toBeNull()
    wrapper.unmount()
  })

  it('shows the reason behind a generic error below it', async () => {
    urlGraphqlError = 'The field `requestId` does not exist on `ParseListingFromUrlInput`.'
    const wrapper = await mountOpen({ listingId: 7 })
    await click('parse-url')

    const error = () => document.body.querySelector('[data-testid="parse-url-error"]')
    await vi.waitFor(() => expect(error()?.textContent).toContain('Something went wrong'))
    expect(error()?.querySelector('[data-testid="ai-error-detail"]')?.textContent).toContain(
      'The field `requestId` does not exist'
    )
    urlGraphqlError = ''
    wrapper.unmount()
  })

  describe('AI safeguards', () => {
    const safetyError = (code: string) => ({
      parseJob: null,
      errors: [{ __typename: 'AiSafetyError', message: `Stopped: ${code}`, code }]
    })
    const openPaste = async () => {
      const wrapper = await mountOpen({})
      wrapper.vm.source = 'text'
      await typeAd('Some ad')
      return wrapper
    }

    it('sends a new request id per run and reuses it only after no answer', async () => {
      respondToBuiltInParse({ parseJob: { status: 'FAILED', result: null, error: 'x' } })
      sentRequestIds = []
      const wrapper = await openPaste()
      // Each run waits for the previous answer: the button is disabled while one is running.
      const run = async (count: number) => {
        await click('parse-builtin-run')
        await vi.waitFor(() => expect(sentRequestIds).toHaveLength(count))
        await vi.waitFor(() =>
          expect(
            document.body.querySelector<HTMLButtonElement>('[data-testid="parse-builtin-run"]')
              ?.disabled
          ).toBe(false)
        )
      }
      await run(1)
      await run(2)
      builtInFails = true
      await run(3)
      builtInFails = false
      await run(4)

      const [first, second, failed, retried] = sentRequestIds
      expect(first).toEqual(expect.any(String))
      expect(second).not.toBe(first)
      expect(failed).not.toBe(second)
      expect(retried).toBe(failed)
      wrapper.unmount()
    })

    it('links a reached daily limit to Settings and keeps the ad', async () => {
      respondToBuiltInParse(safetyError('daily-limit-reached'))
      const wrapper = await openPaste()
      await click('parse-builtin-run')

      const error = () => document.body.querySelector('[data-testid="parse-builtin-error"]')
      await vi.waitFor(() => expect(error()?.textContent).toContain('Stopped: daily-limit-reached'))
      expect(
        error()?.querySelector('[data-testid="ai-limit-settings"]')?.getAttribute('href')
      ).toBe('/settings')
      expect(
        document.body.querySelector<HTMLTextAreaElement>('[data-testid="parse-ad"]')!.value
      ).toBe('Some ad')
      wrapper.unmount()
    })

    it('asks before another run after an interrupted one', async () => {
      respondToBuiltInParse(safetyError('operation-interrupted'))
      sentRequestIds = []
      const wrapper = await openPaste()
      await click('parse-builtin-run')

      const confirm = () => document.body.querySelector('[data-testid="ai-retry-confirm"]')
      await vi.waitFor(() => expect(confirm()?.textContent).toContain('may already have been'))
      const run = document.body.querySelector<HTMLButtonElement>(
        '[data-testid="parse-builtin-run"]'
      )!
      expect(run.disabled).toBe(true)

      respondToBuiltInParse({ parseJob: { status: 'FAILED', result: null, error: 'x' } })
      await click('ai-retry-confirm-run')
      await vi.waitFor(() => expect(sentRequestIds).toHaveLength(2))
      expect(sentRequestIds[1]).not.toBe(sentRequestIds[0])
      expect(confirm()).toBeNull()
      wrapper.unmount()
    })

    it('keeps the retry on the source that was sent, and off without its input', async () => {
      respondToBuiltInParse(safetyError('operation-interrupted'))
      sentRequestIds = []
      const wrapper = await openPaste()
      await click('parse-builtin-run')
      await vi.waitFor(() =>
        expect(document.body.querySelector('[data-testid="ai-retry-confirm"]')).not.toBeNull()
      )

      const radios = [
        ...document.body.querySelectorAll<HTMLButtonElement>(
          '[data-testid="parse-source"] [role="radio"]'
        )
      ]
      expect(radios.length).toBeGreaterThan(0)
      expect(radios.every((radio) => radio.disabled)).toBe(true)
      const retry = () =>
        document.body.querySelector<HTMLButtonElement>('[data-testid="ai-retry-confirm-run"]')!
      expect(retry().disabled).toBe(false)
      await typeAd('')
      expect(retry().disabled).toBe(true)
      expect(sentRequestIds).toHaveLength(1)
      wrapper.unmount()
    })
  })
})

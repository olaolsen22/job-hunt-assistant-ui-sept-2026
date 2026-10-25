import type { AiMethod } from '~/composables/useAiMethod'

// What every AI modal repeats: open on the last-used method, start each open without an error,
// forget the error's safety code once the error is gone, and fetch today's usage for the cost
// notice on open (pages that merely contain the modal make no request); refreshUsage() after a run. `tabFor` maps the remembered method
// to this modal's first tab, and onOpen gets the tab (the immediate run happens before the caller
// has its own refs back) (the CV import's built-in tab is "paste"). Opened already (the edit
// page's ?analyze) is covered by `immediate`.
export const useAiModalState = <Tab extends string = AiMethod>(
  open: Ref<boolean>,
  options: { tabFor?: (method: AiMethod | null) => Tab; onOpen?: (tab: Ref<Tab>) => void } = {}
) => {
  const method = useAiMethod()
  const tabFor = options.tabFor ?? ((m: AiMethod | null) => (m ?? 'builtin') as Tab)
  const tab = ref(tabFor(method.value)) as Ref<Tab>
  const error = ref('')
  const errorCode = ref<string>()
  const { data: usageData, refresh: refreshUsage } = useLlmUsage(false)
  const usage = computed(() => usageData.value?.llmUsageToday)

  watch(
    open,
    (isOpen) => {
      if (!isOpen) return
      tab.value = tabFor(method.value)
      error.value = ''
      refreshUsage()
      options.onOpen?.(tab)
    },
    { immediate: true }
  )
  watch(error, (value) => {
    if (!value) errorCode.value = undefined
  })

  return { method, tab, error, errorCode, usage, refreshUsage }
}

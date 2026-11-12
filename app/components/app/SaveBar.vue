<script setup lang="ts">
// The long editors' bottom bar: sticky so saving stays in reach, translucent like the dashboard
// header. On phones the status takes its own line above equal buttons. The buttons go in the default
// slot; give them `w-full justify-center sm:w-auto`, and `col-span-2 sm:col-auto` to one taking a
// whole phone line.
const { align = 'end' } = defineProps<{
  status: string
  statusTestid: string
  // Unsaved work shows a dot instead of the check; `warn` colors it.
  changed: boolean
  warn: boolean
  align?: 'start' | 'end'
}>()
useToastClearance(useTemplateRef('bar'))
</script>

<template>
  <div
    ref="bar"
    class="sticky bottom-0 z-10 space-y-3 rounded-md border border-default bg-default/90 p-3 backdrop-blur"
  >
    <slot name="above" />
    <div class="grid grid-cols-2 items-center gap-3 sm:flex sm:flex-wrap">
      <span
        class="order-first col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted sm:order-none sm:col-auto sm:flex-1"
        :class="align === 'end' ? 'sm:justify-end' : ''"
      >
        <span class="inline-flex items-center gap-1.5">
          <UIcon
            :name="changed ? 'i-lucide-circle-dot' : 'i-lucide-check'"
            :class="warn ? 'text-warning' : ''"
          />
          <span :data-testid="statusTestid">{{ status }}</span>
        </span>
        <slot name="status" />
      </span>
      <slot />
    </div>
  </div>
</template>

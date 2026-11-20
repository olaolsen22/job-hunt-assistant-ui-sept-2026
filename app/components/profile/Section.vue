<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

// One profile card, styled like the tailored CV's sections: always open, labelled Add/Edit
// buttons, and a ⋮ menu for the rarer actions (`menuItems`, then Clear section).
const {
  title,
  empty,
  clearable,
  count = undefined,
  menuItems = []
} = defineProps<{
  title: string
  icon: string
  empty: boolean
  emptyMessage: string
  addLabel: string
  testid: string
  full?: boolean
  clearable?: boolean
  count?: number
  menuItems?: DropdownMenuItem[]
}>()
const emit = defineEmits<{ add: []; clear: [] }>()

// While the Norwegian (other-language) view is open, the English text is read only: editing it
// would mark its translations outdated. Optional, so the card also works outside the page.
const translation = inject(PROFILE_TRANSLATION_KEY, null)
const readOnly = computed(() => !!translation?.translating.value)

const menu = computed<DropdownMenuItem[]>(() => [
  ...menuItems,
  ...(clearable && !empty
    ? [
        {
          label: 'Clear section…',
          icon: 'i-lucide-eraser',
          color: 'error' as const,
          onSelect: () => emit('clear')
        }
      ]
    : [])
])
</script>

<template>
  <AppCard :id="testid" class="scroll-mt-4" :data-testid="testid">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h2 class="font-semibold">
          {{ title
          }}<span v-if="count && count > 0" class="font-normal text-muted"> · {{ count }}</span>
        </h2>
        <div v-if="!readOnly" class="flex items-center gap-2">
          <slot name="actions">
            <UButton
              v-if="!empty && !full"
              icon="i-lucide-plus"
              color="neutral"
              variant="subtle"
              size="sm"
              :aria-label="addLabel"
              :data-testid="`${testid}-add`"
              @click="emit('add')"
              >Add</UButton
            >
          </slot>
          <UDropdownMenu v-if="menu.length" :items="menu" :content="{ align: 'end' }">
            <UButton
              icon="i-lucide-ellipsis-vertical"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="`Actions for ${title}`"
              :data-testid="`${testid}-menu`"
            />
          </UDropdownMenu>
        </div>
      </div>
    </template>

    <div v-if="empty" class="flex items-center gap-3" :data-testid="`${testid}-empty`">
      <UIcon :name="icon" class="size-5 shrink-0 text-muted" />
      <p class="min-w-0 flex-1 text-sm text-muted">{{ emptyMessage }}</p>
      <UButton
        v-if="!readOnly"
        color="neutral"
        variant="subtle"
        icon="i-lucide-plus"
        size="sm"
        :data-testid="`${testid}-add`"
        @click="emit('add')"
        >{{ addLabel }}</UButton
      >
    </div>
    <slot v-else />
  </AppCard>
</template>

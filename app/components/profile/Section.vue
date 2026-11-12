<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const props = withDefaults(
  defineProps<{
    title: string
    icon: string
    empty: boolean
    emptyMessage: string
    addLabel: string
    testid: string
    full?: boolean
    clearable?: boolean
    compactEmpty?: boolean
    count?: number
    collapsible?: boolean
    defaultOpen?: boolean
  }>(),
  { compactEmpty: true, defaultOpen: true, collapsible: undefined, count: undefined }
)
const emit = defineEmits<{ add: []; clear: [] }>()

// When provided by the profile page, sections become collapsible on mobile automatically.
const injectedCollapsible = inject<Ref<boolean> | null>('profile-mobile-collapsible', null)
const isCollapsible = computed(() => props.collapsible ?? injectedCollapsible?.value ?? false)
const isOpen = ref(props.defaultOpen)

// The page's jump links name a section; open it so the jump never lands on a closed card.
const jumpTarget = inject<Ref<string | null> | null>('profile-jump-target', null)
if (jumpTarget)
  watch(jumpTarget, (id) => {
    if (id === props.testid) isOpen.value = true
  })

const toggle = () => {
  if (isCollapsible.value) isOpen.value = !isOpen.value
}

const menu = computed<DropdownMenuItem[]>(() => [
  {
    label: 'Clear section',
    icon: 'i-lucide-eraser',
    color: 'error',
    onSelect: () => emit('clear')
  }
])
</script>

<template>
  <!-- UCard always renders its padded body; hide it while collapsed so no empty strip shows. -->
  <AppCard
    :id="testid"
    class="scroll-mt-4"
    :data-testid="testid"
    :ui="isCollapsible && !isOpen ? { body: 'hidden' } : undefined"
  >
    <template #header>
      <div
        class="flex items-center justify-between gap-2"
        :role="isCollapsible ? 'button' : undefined"
        :aria-expanded="isCollapsible ? isOpen : undefined"
        :tabindex="isCollapsible ? 0 : undefined"
        @click="toggle"
        @keydown.enter.prevent="toggle"
        @keydown.space.prevent="toggle"
      >
        <h2 class="font-semibold">
          <UIcon
            v-if="isCollapsible"
            name="i-lucide-chevron-right"
            class="mr-1 inline-block size-4 align-text-bottom transition-transform"
            :class="{ 'rotate-90': isOpen }"
          />{{ title
          }}<span v-if="count && count > 0" class="font-normal text-muted"> · {{ count }}</span>
        </h2>
        <div v-if="!isCollapsible || isOpen" class="flex items-center gap-1" @click.stop>
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
          <UDropdownMenu v-if="clearable && !empty" :items="menu" :content="{ align: 'end' }">
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

    <template v-if="!isCollapsible || isOpen">
      <div
        v-if="empty && compactEmpty"
        class="flex items-center gap-3"
        :data-testid="`${testid}-empty`"
      >
        <UIcon :name="icon" class="size-5 shrink-0 text-muted" />
        <p class="min-w-0 flex-1 text-sm text-muted">{{ emptyMessage }}</p>
        <UButton
          color="neutral"
          variant="subtle"
          icon="i-lucide-plus"
          size="sm"
          :data-testid="`${testid}-add`"
          @click="emit('add')"
          >{{ addLabel }}</UButton
        >
      </div>
      <div
        v-else-if="empty"
        class="flex flex-col items-center justify-center gap-3 py-6 text-center"
        :data-testid="`${testid}-empty`"
      >
        <UIcon :name="icon" class="size-10 text-muted" />
        <p>{{ emptyMessage }}</p>
        <UButton
          color="neutral"
          variant="subtle"
          icon="i-lucide-plus"
          :data-testid="`${testid}-add`"
          @click="emit('add')"
          >{{ addLabel }}</UButton
        >
      </div>
      <slot v-else />
    </template>
  </AppCard>
</template>

<script setup lang="ts">
import type { ComparedListing } from '~/composables/listingCompareFields'
import { DEADLINE_TYPE_OPTIONS } from '~/constants/listing'
import { PHONE_FULLSCREEN_MODAL } from '~/constants/ui'

const { listing, matches } = defineProps<{
  listing: ComparedListing
  matches: ComparedListing[]
  loading?: boolean
}>()
const open = defineModel<boolean>('open', { required: true })
const matchId = defineModel<number>('matchId', { required: true })
const emit = defineEmits<{ keep: []; remove: [] }>()

const match = computed(() => matches.find((m) => m.id === matchId.value) ?? matches[0]!)
const matchItems = computed(() =>
  matches.map((m) => ({ label: `${m.title} · ${m.company.name}`, value: m.id }))
)
const matchNumber = computed(() => matches.findIndex((m) => m.id === match.value.id) + 1)

// Remove is confirmed in the footer so cancelling keeps the comparison on screen.
const confirming = ref(false)
watch(open, () => (confirming.value = false))

const SIDES = [
  { label: 'New', color: 'neutral' },
  { label: 'Existing', color: 'warning' }
] as const

// Compared as displayed text, so e.g. the same locations in another order still match.
const fields = (l: ComparedListing) => ({
  Title: l.title,
  Company: l.company.name,
  Role: l.jobRole.name,
  URL: l.url,
  Locations: l.locations
    .map((x) => formatLocation(x.location))
    .sort()
    .join(' · '),
  Posted: formatDate(l.postedOn),
  Deadline:
    l.deadlineType === 'DATE' && l.deadlineOn
      ? formatDate(l.deadlineOn)
      : DEADLINE_TYPE_OPTIONS.find((o) => o.value === l.deadlineType)!.label,
  Status: l.status
})

// The fields that identify a duplicate come first among the differing ones.
const PRIORITY = ['URL', 'Title', 'Company']

const rows = computed(() => {
  const left = fields(listing)
  const right = fields(match.value)
  return (Object.keys(left) as (keyof typeof left)[]).map((label) => ({
    label,
    values: [left[label], right[label]],
    same: left[label] === right[label]
  }))
})
const priority = (label: string) => {
  const i = PRIORITY.indexOf(label)
  return i === -1 ? PRIORITY.length : i
}
const differing = computed(() =>
  rows.value.filter((r) => !r.same).sort((a, b) => priority(a.label) - priority(b.label))
)
const same = computed(() => rows.value.filter((r) => r.same))
const summary = computed(() =>
  differing.value.length
    ? `${differing.value.length} of ${rows.value.length} fields differ`
    : 'All fields match — this looks like the same listing.'
)
</script>

<template>
  <!-- The default sm:max-w-lg is too narrow for a label column plus two value columns. -->
  <UModal
    v-model:open="open"
    title="Compare listings"
    :description="summary"
    :dismissible="!loading"
    :ui="{ content: `sm:max-w-3xl ${PHONE_FULLSCREEN_MODAL}` }"
  >
    <template #body>
      <UFormField
        v-if="matches.length > 1"
        :label="`Match ${matchNumber} of ${matches.length}`"
        class="mb-4"
      >
        <USelect
          v-model="matchId"
          :items="matchItems"
          class="w-full"
          data-testid="compare-select"
        />
      </UFormField>

      <dl class="text-sm">
        <div
          class="hidden grid-cols-[8rem_1fr_1fr] gap-x-4 border-b border-default px-2 pb-2 text-muted sm:grid"
        >
          <span />
          <span v-for="side in SIDES" :key="side.label">{{ side.label }}</span>
        </div>
        <ListingsCompareRows :rows="differing" :listing="listing" :match="match" />
      </dl>

      <UCollapsible v-if="same.length" class="mt-3">
        <UButton
          color="neutral"
          variant="link"
          size="sm"
          trailing-icon="i-lucide-chevron-down"
          data-testid="compare-same-toggle"
          >Same in both ({{ same.length }})</UButton
        >
        <template #content>
          <dl class="text-sm">
            <ListingsCompareRows :rows="same" :listing="listing" :match="match" />
          </dl>
        </template>
      </UCollapsible>
    </template>

    <template #footer>
      <div
        v-if="confirming"
        class="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end"
        data-testid="compare-confirm"
      >
        <p class="text-sm text-highlighted sm:mr-auto">Remove “{{ listing.title }}”?</p>
        <div class="flex flex-col-reverse gap-2 sm:flex-row">
          <UButton
            color="neutral"
            variant="ghost"
            class="justify-center"
            :disabled="loading"
            data-testid="compare-confirm-cancel"
            @click="confirming = false"
            >Cancel</UButton
          >
          <UButton
            color="error"
            class="justify-center"
            :loading="loading"
            data-testid="compare-confirm-remove"
            @click="emit('remove')"
            >Remove</UButton
          >
        </div>
      </div>
      <div v-else class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <UButton
          :to="`/listings/${match.id}`"
          target="_blank"
          icon="i-lucide-external-link"
          color="neutral"
          variant="ghost"
          class="justify-center sm:mr-auto"
          >Open existing</UButton
        >
        <UButton
          color="neutral"
          variant="subtle"
          class="justify-center"
          data-testid="compare-keep"
          @click="emit('keep')"
          >Keep both</UButton
        >
        <UButton
          color="error"
          variant="soft"
          class="justify-center"
          data-testid="compare-remove"
          @click="confirming = true"
          >Remove new one</UButton
        >
      </div>
    </template>
  </UModal>
</template>

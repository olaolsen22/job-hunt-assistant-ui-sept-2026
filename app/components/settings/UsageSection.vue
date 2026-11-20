<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import type { UsageGroup, UsageLine } from '~/utils/llmUsage'

// Owner only: recent built-in AI use per model and key. The app's key counts every user (the
// owner and guests), so it is its own group and never added to the owner's keys.
const RANGES = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 }
]
const days = ref(30)
const { data, status, error, refresh } = useLlmUsageHistory(days)
const summary = computed(() => summarizeUsage(data.value?.usageDaily ?? []))

const { models } = useLlmModels()
const { keyFor } = useProviderKeys()
// History may name a model that is no longer offered; its raw id still says enough.
const modelLabel = (line: UsageLine) =>
  models.value.find((m) => m.provider === line.provider && m.modelId === line.model)?.label ??
  line.model
const keyLabel = (line: UsageLine) => {
  const key = keyFor(line.credentialId)
  if (!key?.last4) return `${providerLabel(line.provider)} key`
  // Removing a key retires it too, so "old" rather than "replaced".
  return `${key.retiredAt ? 'Old key' : 'Key'} •••• ${key.last4}`
}

const count = new Intl.NumberFormat()
const tokens = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const usd = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' })
const cost = (value: number | null) => {
  if (value == null) return 'No price'
  return value > 0 && value < 0.01 ? `< ${usd.format(0.01)}` : usd.format(value)
}

const lineCost = (line: UsageLine) =>
  line.estimatedCost == null
    ? 'No price'
    : `${line.unpriced ? 'at least ' : ''}${cost(line.estimatedCost)}`
const groupCost = (group: UsageGroup) =>
  group.lines.every((l) => l.estimatedCost == null)
    ? 'No price'
    : `${group.partlyPriced ? 'at least ' : ''}${cost(group.estimatedCost)}`

// The key sits under the model, so a phone keeps the cost column; tokens drop below sm. Fixed
// widths line the two groups' tables up.
const numeric = (width: string, phone = true) => {
  const cell = `${width} text-right whitespace-nowrap ${phone ? '' : 'hidden sm:table-cell'}`
  return { class: { th: cell, td: cell } }
}
const columns: TableColumn<UsageLine>[] = [
  { accessorKey: 'model', header: 'Model' },
  { accessorKey: 'requests', header: 'Requests', meta: numeric('w-24') },
  { accessorKey: 'inputTokens', header: 'Tokens in / out', meta: numeric('w-36', false) },
  { accessorKey: 'estimatedCost', header: 'Est. cost', meta: numeric('w-28') }
]

const groups = computed(() =>
  [
    { id: 'own', title: 'Your keys', note: 'Your requests only.', group: summary.value.own },
    {
      id: 'shared',
      title: 'App’s key',
      note: 'All users, guests included: what the demo costs.',
      group: summary.value.shared
    }
  ].filter((g) => g.group.lines.length > 0)
)
</script>

<template>
  <AppCard id="usage" title="Usage" class="scroll-mt-20" data-testid="settings-usage">
    <template #actions>
      <USelect
        v-model="days"
        :items="RANGES"
        size="md"
        class="w-40"
        aria-label="Usage period"
        data-testid="settings-usage-range"
      />
    </template>

    <div v-if="error" class="space-y-3">
      <UAlert color="error" :description="ERROR_MESSAGES.generic" />
      <UButton color="neutral" variant="subtle" icon="i-lucide-refresh-cw" @click="refresh()"
        >Try again</UButton
      >
    </div>
    <!-- Only the first load: another period keeps the old numbers until the new ones arrive. -->
    <div v-else-if="!data" class="space-y-3">
      <USkeleton class="h-5 w-1/2" />
      <USkeleton class="h-24 w-full" />
    </div>
    <div
      v-else-if="!groups.length"
      class="flex flex-col items-center gap-3 py-6 text-center"
      data-testid="settings-usage-empty"
    >
      <UIcon name="i-lucide-chart-no-axes-column" class="size-10 text-muted" />
      <p class="text-sm text-muted">No AI requests in the last {{ days }} days.</p>
    </div>
    <div v-else class="space-y-6">
      <section
        v-for="{ id, title, note, group } in groups"
        :key="id"
        class="space-y-2"
        :data-testid="`settings-usage-${id}`"
      >
        <div>
          <h3 class="font-medium text-highlighted">{{ title }}</h3>
          <p class="text-sm text-muted">{{ note }}</p>
        </div>
        <p class="text-sm" data-testid="settings-usage-total">
          <span class="font-semibold text-highlighted">{{ count.format(group.requests) }}</span>
          requests · {{ tokens.format(group.inputTokens) }} tokens in,
          {{ tokens.format(group.outputTokens) }} out · est.
          <span class="font-semibold text-highlighted">{{ groupCost(group) }}</span>
        </p>
        <UTable
          :data="group.lines"
          :columns="columns"
          :loading="status === 'pending'"
          class="-mx-1"
        >
          <template #model-cell="{ row }">
            <p class="text-highlighted">{{ modelLabel(row.original) }}</p>
            <p class="text-xs text-muted">
              {{ id === 'shared' ? 'App’s key' : keyLabel(row.original) }}
            </p>
          </template>
          <template #requests-cell="{ row }">{{ count.format(row.original.requests) }}</template>
          <template #inputTokens-cell="{ row }"
            >{{ tokens.format(row.original.inputTokens) }} /
            {{ tokens.format(row.original.outputTokens) }}</template
          >
          <template #estimatedCost-cell="{ row }">{{ lineCost(row.original) }}</template>
        </UTable>
      </section>
      <p class="text-xs text-muted">
        Costs are estimates at the provider’s paid-tier price in USD. Your provider’s bill is the
        real cost. Days follow Pacific time.
      </p>
    </div>
  </AppCard>
</template>

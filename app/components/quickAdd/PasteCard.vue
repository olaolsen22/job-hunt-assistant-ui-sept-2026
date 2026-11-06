<script setup lang="ts">
import type { QuickAddPaste } from '~/composables/useQuickAddPaste'

// The input step: ads through built-in or your own AI, or a collected jobs file. Its state lives in
// useQuickAddPaste, because the page's leave guard and imports need it too.
const { paste } = defineProps<{ paste: QuickAddPaste; saving: boolean }>()
defineEmits<{ edit: [] }>()

const INPUT_MODES = [
  { label: 'Paste text', value: 'text' },
  { label: 'Collected jobs', value: 'collected' }
]

const {
  ad,
  json,
  jsonError,
  aiTab,
  builtIn,
  inputMode,
  collectedMode,
  collected,
  checking,
  checkError,
  prepared,
  collectedError,
  processing,
  aiDisabled,
  instructions,
  copied,
  parsing,
  needsConfirm,
  safetyMessage
} = paste
const runStatus = paste.batchRun.status
</script>

<template>
  <UCard data-testid="quick-add-paste">
    <div class="space-y-6">
      <!-- A column, not space-y: inline buttons would sit side by side, offset. -->
      <div class="flex flex-col gap-3">
        <UFormField label="Input">
          <UFieldGroup class="w-full">
            <UButton
              v-for="mode in INPUT_MODES"
              :key="mode.value"
              :label="mode.label"
              color="neutral"
              :variant="inputMode === mode.value ? 'solid' : 'outline'"
              :aria-pressed="inputMode === mode.value"
              :disabled="checking || parsing || processing || saving"
              class="flex-1"
              :data-testid="`quick-add-mode-${mode.value}`"
              @click="inputMode = mode.value"
            />
          </UFieldGroup>
        </UFormField>
        <AppAiMethodTabs v-model="aiTab" :disabled="checking || parsing || processing || saving" />
        <UFormField
          v-if="!collectedMode"
          :label="
            builtIn
              ? 'Paste one or more ads, or a job-board results page'
              : '1. Paste one or more ads, or a job-board results page'
          "
          help="Only the basics are parsed; fill in the details later."
        >
          <UTextarea
            v-model="ad"
            :rows="6"
            :maxrows="12"
            autoresize
            placeholder="The ads or results page text"
            class="w-full"
            :disabled="parsing || processing || saving"
            data-testid="quick-add-ad"
          />
        </UFormField>
        <template v-else>
          <UFormField
            :label="builtIn ? 'Collected jobs' : '1. Collected jobs'"
            help='Paste the full listing JSON array. Each job needs a URL; all other fields are kept. Example: [{ "title": "Waiter", "companyName": "Acme", "url": "https://example.com/job/1" }]'
          >
            <UTextarea
              v-model="collected"
              :rows="6"
              :maxrows="12"
              autoresize
              :disabled="checking || parsing || processing || saving"
              :readonly="!!prepared"
              placeholder="The collected jobs JSON array"
              class="w-full font-mono"
              data-testid="quick-add-collected"
            />
          </UFormField>
          <UButton
            :loading="checking"
            :disabled="
              !collected.trim() || checking || parsing || processing || saving || !!prepared
            "
            class="max-sm:justify-center sm:self-start"
            data-testid="quick-add-check"
            @click="paste.checkJobs()"
            >Check jobs</UButton
          >
          <UAlert
            v-if="checkError"
            color="error"
            icon="i-lucide-circle-alert"
            :title="checkError"
            data-testid="quick-add-check-error"
          />
          <p
            v-if="prepared"
            class="text-sm text-muted"
            role="status"
            data-testid="quick-add-check-summary"
          >
            {{ prepared.remaining + prepared.skipped }} collected · {{ prepared.skipped }} skipped ·
            {{ prepared.remaining }} ready
          </p>
          <UButton
            v-if="prepared?.remaining && runStatus === 'idle'"
            icon="i-lucide-rows-3"
            :disabled="saving"
            class="max-sm:justify-center sm:self-start"
            data-testid="quick-add-add-collected"
            @click="paste.addCollectedRows()"
            >Add {{ prepared.remaining }} {{ prepared.remaining === 1 ? 'job' : 'jobs' }} as
            rows</UButton
          >
          <UButton
            v-if="prepared && runStatus !== 'finished' && runStatus !== 'stopped'"
            color="neutral"
            variant="ghost"
            :disabled="saving || processing"
            class="max-sm:justify-center sm:self-start"
            data-testid="quick-add-edit-collected"
            @click="$emit('edit')"
            >Edit collected jobs</UButton
          >
          <div
            v-if="prepared && !prepared.remaining"
            class="py-6 text-center text-muted"
            data-testid="quick-add-check-empty"
          >
            <UIcon name="i-lucide-check-check" class="mb-2 size-8" />
            <p>No new jobs remain.</p>
          </div>
        </template>
        <UButton
          v-if="builtIn"
          icon="i-lucide-sparkles"
          :loading="parsing"
          :disabled="aiDisabled || saving || (collectedMode && runStatus !== 'idle')"
          class="max-sm:justify-center sm:self-start"
          data-testid="quick-add-builtin-run"
          @click="collectedMode ? paste.startProcessing() : paste.parseBuiltIn()"
        >
          {{ collectedMode ? `Process ${prepared?.remaining ?? 0} jobs` : 'Parse into rows' }}
        </UButton>
        <AppAiRetryConfirm
          v-if="builtIn && needsConfirm && runStatus === 'idle'"
          :message="safetyMessage"
          :loading="parsing"
          @retry="paste.retryConfirmed()"
        />
        <p v-if="builtIn && collectedMode" class="text-sm text-muted">
          Creates drafts for review. Nothing is saved until you choose Save.
        </p>
        <UAlert
          v-if="collectedError"
          color="error"
          icon="i-lucide-circle-alert"
          :title="collectedError"
          data-testid="quick-add-process-error"
        />
        <UButton
          v-if="!builtIn"
          :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
          :color="copied ? 'success' : 'primary'"
          variant="subtle"
          :loading="!instructions"
          :disabled="
            aiDisabled || !instructions || saving || (collectedMode && runStatus !== 'idle')
          "
          class="max-sm:justify-center sm:self-start"
          data-testid="quick-add-copy-prompt"
          @click="paste.copyPrompt()"
        >
          {{ copied ? 'Copied' : 'Copy prompt' }}
        </UButton>
      </div>

      <USeparator v-if="!builtIn" />

      <div v-if="!builtIn" class="flex flex-col gap-3">
        <UFormField label="2. Paste the AI’s reply" :error="jsonError || undefined">
          <UTextarea
            v-model="json"
            :rows="6"
            :maxrows="12"
            autoresize
            placeholder="The JSON array the AI returned"
            class="w-full font-mono"
            :disabled="processing || saving || (collectedMode && runStatus !== 'idle')"
            data-testid="quick-add-json"
          />
        </UFormField>
        <UButton
          :disabled="
            !json.trim() || processing || saving || (collectedMode && runStatus !== 'idle')
          "
          class="max-sm:justify-center sm:self-start"
          data-testid="quick-add-parse"
          @click="paste.addOwnRows()"
          >Parse into rows</UButton
        >
      </div>
    </div>
  </UCard>
</template>

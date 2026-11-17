<script setup lang="ts">
import { LANGUAGE_OPTIONS, type Language } from '~/constants/listing'
import type { CoverLetter } from '~/utils/coverLetter'

// The letter's details in one place, like the tailored CV's settings strip: a summary line, and a
// panel with the sender, recipient, date and language. They're prefilled from the profile and
// rarely change. The default slot adds rows under the summary (the latest PDF).
const { disabled = false, resetting = false } = defineProps<{
  disabled?: boolean
  resetting?: boolean
}>()
const letter = defineModel<CoverLetter>('letter', { required: true })
const emit = defineEmits<{ resetHeader: [] }>()

// The API prints line 1 as the street and line 2 as postcode and town, splitting one line at a comma.
const ADDRESS_HELP = 'Street and number on line 1, postcode and town on line 2.'

const languageName = (value: Language) =>
  LANGUAGE_OPTIONS.find((o) => o.value === value)?.label ?? value
const summary = computed(() => {
  const to = letter.value.organization.trim() || letter.value.recipientName.trim()
  return [
    languageName(letter.value.language),
    to ? `To ${to}` : 'No recipient',
    letter.value.date ? formatDate(letter.value.date) : 'No date'
  ].join(' · ')
})

// A side panel from tablet up, a bottom sheet on phones. Decided when it opens, like AppFilterSheet.
const open = defineModel<boolean>('open', { default: false })
const side = ref<'right' | 'bottom'>('right')
// The language the text was in when the panel opened: changing it rewrites nothing by itself.
const openedLanguage = ref<Language>(letter.value.language)
watch(open, (isOpen) => {
  if (!isOpen) return
  side.value = window.matchMedia('(min-width: 768px)').matches ? 'right' : 'bottom'
  openedLanguage.value = letter.value.language
})
const languageChanged = computed(
  () => letter.value.language !== openedLanguage.value && hasCoverLetterBody(letter.value)
)
</script>

<template>
  <AppCard data-testid="cover-letter-details">
    <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <p class="min-w-0 text-sm text-highlighted" data-testid="cover-letter-details-summary">
        {{ summary }}
      </p>
      <UButton
        icon="i-lucide-sliders-horizontal"
        color="neutral"
        variant="subtle"
        size="sm"
        :disabled="disabled"
        data-testid="cover-letter-details-open"
        @click="open = true"
        >Edit details</UButton
      >
    </div>
    <slot />

    <USlideover
      v-model:open="open"
      :side="side"
      title="Letter details"
      description="Printed above the letter. Prefilled from your profile."
    >
      <template #body>
        <!-- The panel is teleported out of the page's fieldset, so it disables its own fields while
             a save swaps in the API's copy. -->
        <fieldset :disabled="disabled" class="min-w-0 space-y-6" data-testid="cover-letter-header">
          <section class="space-y-4" aria-labelledby="cover-letter-details-language">
            <h3 id="cover-letter-details-language" class="font-medium text-highlighted">
              Language
            </h3>
            <URadioGroup
              v-model="letter.language"
              :items="[...LANGUAGE_OPTIONS]"
              orientation="horizontal"
              aria-label="Letter language"
              data-testid="cover-letter-language"
            />
            <UAlert
              v-if="languageChanged"
              color="info"
              variant="subtle"
              icon="i-lucide-info"
              :description="`The letter text stays as written. Write with AI again to get it in ${languageName(letter.language)}.`"
              data-testid="cover-letter-language-note"
            />
          </section>
          <USeparator />
          <section class="space-y-4" aria-labelledby="cover-letter-details-from">
            <h3 id="cover-letter-details-from" class="font-medium text-highlighted">From</h3>
            <UFormField label="Full name">
              <UInput v-model="letter.fullName" class="w-full" autocomplete="name" />
            </UFormField>
            <UFormField label="Address" :help="ADDRESS_HELP">
              <UTextarea
                v-model="letter.address"
                :rows="2"
                autoresize
                placeholder="Storgata 1&#10;0155 Oslo"
                class="w-full"
              />
            </UFormField>
            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField label="Email">
                <UInput v-model="letter.email" type="email" class="w-full" autocomplete="email" />
              </UFormField>
              <UFormField label="Phone">
                <UInput v-model="letter.phone" type="tel" class="w-full" autocomplete="tel" />
              </UFormField>
            </div>
            <UFormField label="Date">
              <UInput v-model="letter.date" type="date" class="w-full" />
            </UFormField>
          </section>
          <USeparator />
          <section class="space-y-4" aria-labelledby="cover-letter-details-to">
            <h3 id="cover-letter-details-to" class="font-medium text-highlighted">To</h3>
            <UFormField label="Organization">
              <UInput v-model="letter.organization" class="w-full" />
            </UFormField>
            <UFormField label="Recipient">
              <UInput v-model="letter.recipientName" class="w-full" />
            </UFormField>
            <UFormField label="Recipient address" :help="ADDRESS_HELP">
              <UTextarea
                v-model="letter.recipientAddress"
                :rows="2"
                autoresize
                placeholder="Kongens gate 2&#10;7011 Trondheim"
                class="w-full"
              />
            </UFormField>
          </section>
        </fieldset>
      </template>
      <template #footer>
        <UButton
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="ghost"
          :loading="resetting"
          :disabled="disabled"
          data-testid="cover-letter-reset-header"
          @click="emit('resetHeader')"
          >Reset details from profile</UButton
        >
        <UButton class="ml-auto" data-testid="cover-letter-details-done" @click="open = false"
          >Done</UButton
        >
      </template>
    </USlideover>
  </AppCard>
</template>

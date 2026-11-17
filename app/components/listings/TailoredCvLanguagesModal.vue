<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { TailoredCv } from '~/utils/tailoredCv'
import { CV_APPLY_DESCRIPTION, PROFICIENCY_OPTIONS } from '~/constants/listing'

// The tailored CV's languages, edited on a copy; Apply puts them back into the page's draft.
type Languages = TailoredCv['languages']
// `profile`: the API's prefill from the profile, what a removed language comes back from.
const props = defineProps<{ languages: Languages; profile?: TailoredCv | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ apply: [languages: Languages] }>()

const copy = (languages: Languages): Languages => JSON.parse(JSON.stringify(languages))
const draft = ref(copy(props.languages))
watch(open, (isOpen) => {
  if (isOpen) draft.value = copy(props.languages)
})

const missing = computed(() => props.profile && missingLanguages(draft.value, props.profile))
const profileItems = computed<DropdownMenuItem[]>(() => {
  if (!missing.value) return [{ label: 'Your profile isn’t loaded yet', disabled: true }]
  if (!missing.value.length)
    return [{ label: 'Everything from your profile is already here', disabled: true }]
  return missing.value.map((language) => ({
    label: language.name,
    onSelect: () => draft.value.push(language)
  }))
})

const apply = () => {
  emit('apply', draft.value)
  open.value = false
}
</script>

<template>
  <AppFormModal
    v-model:open="open"
    title="Edit languages"
    :description="CV_APPLY_DESCRIPTION"
    save-label="Apply"
    :state="draft"
    @submit="apply"
  >
    <div class="space-y-3">
      <p v-if="!draft.length" class="text-sm text-muted">
        No languages in this CV.{{
          missing?.length ? ' Use Add from profile to bring them back.' : ''
        }}
      </p>
      <!-- Phones: name and remove, then both levels side by side; one row from md. -->
      <div
        v-for="(l, i) in draft"
        :key="i"
        class="flex flex-wrap items-end gap-2"
        data-testid="tailored-cv-language-row"
      >
        <UFormField label="Language" class="min-w-0 flex-1">
          <UInput v-model="l.name" class="w-full" />
        </UFormField>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          class="mb-1 md:order-last"
          :aria-label="`Remove language ${i + 1}`"
          @click="draft.splice(i, 1)"
        />
        <div class="grid w-full grid-cols-2 gap-2 md:w-72">
          <UFormField label="Spoken">
            <USelect
              :model-value="l.spoken ?? undefined"
              :items="[...PROFICIENCY_OPTIONS]"
              placeholder="Choose"
              class="w-full"
              @update:model-value="l.spoken = $event"
            />
          </UFormField>
          <UFormField label="Written">
            <USelect
              :model-value="l.written ?? undefined"
              :items="[...PROFICIENCY_OPTIONS]"
              placeholder="Choose"
              class="w-full"
              @update:model-value="l.written = $event"
            />
          </UFormField>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="subtle"
          size="sm"
          @click="draft.push({ name: '', spoken: null, written: null })"
          >Add language</UButton
        >
        <UDropdownMenu :items="profileItems" :content="{ align: 'start' }">
          <UButton
            icon="i-lucide-user-round-plus"
            trailing-icon="i-lucide-chevron-down"
            color="neutral"
            variant="subtle"
            size="sm"
            data-testid="cv-languages-from-profile"
            >Add from profile</UButton
          >
        </UDropdownMenu>
      </div>
    </div>
  </AppFormModal>
</template>

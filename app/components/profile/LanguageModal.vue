<script setup lang="ts">
import { CEFR_LEVELS, LANGUAGE_OPTIONS } from '~/constants/listing'
import type { CefrLevel, Language } from '~/constants/listing'
import type { ProfileLanguage } from '~/composables/useProfile'

// Without `language` it adds one of `available`; with it, it changes that language's level.
const { language, available } = defineProps<{
  language: ProfileLanguage | null
  available: readonly { label: string; value: Language }[]
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

// No `errors` on this payload, so a failure only reaches useMutation's catch.
const SET_LANGUAGE = graphql(`
  mutation SetProfileLanguage($input: SetProfileLanguageInput!) {
    setProfileLanguage(input: $input) {
      profileLanguage {
        language
        level
      }
    }
  }
`)

const chosen = ref<Language>()
const level = ref<CefrLevel>('B2')

watch(open, (isOpen) => {
  if (!isOpen) return
  chosen.value = language?.language ?? available[0]?.value
  level.value = language?.level ?? 'B2'
})

const labelOf = (value?: string) => LANGUAGE_OPTIONS.find((o) => o.value === value)?.label

const { run, loading } = useMutation(() => emit('changed'))

const submit = async () => {
  const ok = await run(async () => {
    await gql(SET_LANGUAGE, { input: { language: chosen.value!, level: level.value } })
    return null
  })
  if (!ok) return
  open.value = false
  emit('changed')
}
</script>

<template>
  <AppFormModal
    v-model:open="open"
    :title="language ? `Edit ${labelOf(language.language)}` : 'Add language'"
    :state="{ chosen, level }"
    :loading="loading"
    @submit="submit"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField label="Language">
        <UInput v-if="language" :model-value="labelOf(chosen)" disabled class="w-full" />
        <USelect
          v-else
          v-model="chosen"
          :items="[...available]"
          class="w-full"
          data-testid="language-choice"
        />
      </UFormField>
      <UFormField label="Level">
        <USelect
          v-model="level"
          :items="[...CEFR_LEVELS]"
          class="w-full"
          data-testid="language-level"
        />
      </UFormField>
    </div>
  </AppFormModal>
</template>

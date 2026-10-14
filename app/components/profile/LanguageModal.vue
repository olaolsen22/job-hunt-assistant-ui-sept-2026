<script setup lang="ts">
import { PROFICIENCY_OPTIONS } from '~/constants/listing'
import type { Proficiency } from '~/constants/listing'
import type { ProfileLanguage } from '~/composables/useProfile'

// Without `language` it adds a new one by name; with it, it changes that language's levels.
const { language } = defineProps<{ language: ProfileLanguage | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const SET_LANGUAGE = graphql(`
  mutation SetProfileLanguage($input: SetProfileLanguageInput!) {
    setProfileLanguage(input: $input) {
      profileLanguage {
        id
        name
        spoken
        written
      }
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

const name = ref('')
const spoken = ref<Proficiency>('GOOD')
const written = ref<Proficiency>('GOOD')

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = language?.name ?? ''
  spoken.value = language?.spoken ?? 'GOOD'
  written.value = language?.written ?? 'GOOD'
})

const { run, loading } = useMutation(() => emit('changed'))

const submit = async () => {
  const ok = await run(async () => {
    const { setProfileLanguage } = await gql(SET_LANGUAGE, {
      input: { name: name.value.trim(), spoken: spoken.value, written: written.value }
    })
    return setProfileLanguage.errors
  })
  if (!ok) return
  open.value = false
  emit('changed')
}
</script>

<template>
  <AppFormModal
    v-model:open="open"
    :title="language ? `Edit ${language.name}` : 'Add language'"
    :state="{ name, spoken, written }"
    :loading="loading"
    @submit="submit"
  >
    <div class="grid gap-4 sm:grid-cols-3">
      <UFormField label="Language" required>
        <UInput
          v-model="name"
          :disabled="!!language"
          required
          class="w-full"
          data-testid="language-name"
        />
      </UFormField>
      <UFormField label="Spoken">
        <USelect
          v-model="spoken"
          :items="[...PROFICIENCY_OPTIONS]"
          class="w-full"
          data-testid="language-spoken"
        />
      </UFormField>
      <UFormField label="Written">
        <USelect
          v-model="written"
          :items="[...PROFICIENCY_OPTIONS]"
          class="w-full"
          data-testid="language-written"
        />
      </UFormField>
    </div>
  </AppFormModal>
</template>

<script setup lang="ts">
import { CEFR_LEVELS, LANGUAGE_OPTIONS } from '~/constants/listing'
import type { CefrLevel, Language } from '~/constants/listing'
import type { ProfileLanguage } from '~/composables/useProfile'

const { languages } = defineProps<{ languages: readonly ProfileLanguage[] }>()
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

const REMOVE_LANGUAGE = graphql(`
  mutation RemoveProfileLanguage($input: RemoveProfileLanguageInput!) {
    removeProfileLanguage(input: $input) {
      language
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

const labelOf = (language: string) =>
  LANGUAGE_OPTIONS.find((o) => o.value === language)?.label ?? language

const unused = computed(() =>
  LANGUAGE_OPTIONS.filter((o) => !languages.some((l) => l.language === o.value))
)
const newLanguage = ref<Language>()
const newLevel = ref<CefrLevel>('B2')
// Falls back to the first free language, so the select is never empty while there is one.
const chosen = computed(() =>
  unused.value.some((o) => o.value === newLanguage.value)
    ? newLanguage.value
    : unused.value[0]?.value
)

const { run, loading } = useMutation(() => emit('changed'))

const setLevel = async (language: Language, level: CefrLevel) => {
  const ok = await run(async () => {
    await gql(SET_LANGUAGE, { input: { language, level } })
    return null
  })
  if (ok) emit('changed')
}

const remove = async (language: Language) => {
  const ok = await run(async () => {
    const { removeProfileLanguage } = await gql(REMOVE_LANGUAGE, { input: { language } })
    return removeProfileLanguage.errors
  })
  if (ok) emit('changed')
}
</script>

<template>
  <!-- Always has the add row, so there is no empty state: nothing to open first. -->
  <AppCard title="Languages" data-testid="profile-languages">
    <ul class="space-y-2">
      <li
        v-for="l in languages"
        :key="l.language"
        class="flex items-center gap-2"
        data-testid="profile-language"
      >
        <span class="min-w-0 flex-1 truncate">{{ labelOf(l.language) }}</span>
        <USelect
          :model-value="l.level"
          :items="[...CEFR_LEVELS]"
          :disabled="loading"
          :aria-label="`${labelOf(l.language)} level`"
          class="w-24"
          @update:model-value="setLevel(l.language, $event)"
        />
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="`Remove ${labelOf(l.language)}`"
          :disabled="loading"
          @click="remove(l.language)"
        />
      </li>
    </ul>

    <div
      v-if="!languages.length"
      class="flex flex-col items-center justify-center gap-3 py-4 text-center"
      data-testid="profile-languages-empty"
    >
      <UIcon name="i-lucide-languages" class="size-10 text-muted" />
      <p>No languages yet.</p>
    </div>

    <div
      v-if="unused.length"
      class="flex items-center gap-2"
      :class="{ 'mt-3 border-t border-default pt-3': languages.length }"
      data-testid="profile-language-add-row"
    >
      <USelect
        :model-value="chosen"
        :items="[...unused]"
        aria-label="Language"
        class="min-w-0 flex-1"
        @update:model-value="newLanguage = $event"
      />
      <USelect v-model="newLevel" :items="[...CEFR_LEVELS]" aria-label="Level" class="w-24" />
      <UButton
        icon="i-lucide-plus"
        color="neutral"
        variant="subtle"
        :loading="loading"
        data-testid="profile-language-add"
        @click="setLevel(chosen!, newLevel)"
        >Add</UButton
      >
    </div>
  </AppCard>
</template>

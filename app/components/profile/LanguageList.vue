<script setup lang="ts">
import { LANGUAGE_OPTIONS } from '~/constants/listing'
import type { ProfileLanguage } from '~/composables/useProfile'

const { languages } = defineProps<{ languages: readonly ProfileLanguage[] }>()
const emit = defineEmits<{ changed: [] }>()

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

const formOpen = ref(false)
const editing = ref<ProfileLanguage | null>(null)
const removing = ref<ProfileLanguage | null>(null)
const removeOpen = computed({
  get: () => !!removing.value,
  set: (value) => {
    if (!value) removing.value = null
  }
})

const openForm = (language: ProfileLanguage | null) => {
  editing.value = language
  formOpen.value = true
}

const { run, loading } = useMutation(() => emit('changed'))

const remove = async () => {
  const language = removing.value!.language
  const ok = await run(async () => {
    const { removeProfileLanguage } = await gql(REMOVE_LANGUAGE, { input: { language } })
    return removeProfileLanguage.errors
  })
  removing.value = null
  if (ok) emit('changed')
}
</script>

<template>
  <ProfileSection
    title="Languages"
    icon="i-lucide-languages"
    testid="profile-languages"
    :empty="!languages.length"
    empty-message="No languages yet."
    add-label="Add language"
    :full="!unused.length"
    @add="openForm(null)"
  >
    <ul class="space-y-2">
      <li
        v-for="l in languages"
        :key="l.language"
        class="flex items-center gap-2"
        data-testid="profile-language"
      >
        <span class="min-w-0 flex-1 truncate">{{ labelOf(l.language) }}</span>
        <UBadge color="neutral" variant="subtle" size="sm">{{ l.level }}</UBadge>
        <ProfileRowActions
          :name="labelOf(l.language)"
          remove-label="Remove"
          testid="profile-language-actions"
          @edit="openForm(l)"
          @remove="removing = l"
        />
      </li>
    </ul>
  </ProfileSection>

  <!-- Outside the section: its body isn't rendered while the section is empty. -->
  <ProfileLanguageModal
    v-model:open="formOpen"
    :language="editing"
    :available="unused"
    @changed="emit('changed')"
  />
  <AppConfirmModal
    v-model:open="removeOpen"
    title="Remove this language?"
    :description="removing ? labelOf(removing.language) : undefined"
    confirm-label="Remove"
    :loading="loading"
    @confirm="remove"
  />
</template>

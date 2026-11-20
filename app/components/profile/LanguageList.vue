<script setup lang="ts">
import { PROFICIENCY_OPTIONS } from '~/constants/listing'
import type { ProfileLanguage } from '~/composables/useProfile'

withDefaults(defineProps<{ languages: readonly ProfileLanguage[]; count?: number }>(), {
  count: undefined
})
const emit = defineEmits<{ changed: []; clear: [] }>()

// Read only in the translated view (see ProfileSection).
const { translating } = useProfileTranslation()

const REMOVE_LANGUAGE = graphql(`
  mutation RemoveProfileLanguage($input: RemoveProfileLanguageInput!) {
    removeProfileLanguage(input: $input) {
      name
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

const proficiencyLabel = (value: string) =>
  PROFICIENCY_OPTIONS.find((o) => o.value === value)?.label ?? value

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
  const name = removing.value!.name
  const ok = await run(async () => {
    const { removeProfileLanguage } = await gql(REMOVE_LANGUAGE, { input: { name } })
    return removeProfileLanguage.errors
  })
  removing.value = null
  if (ok) emit('changed')
}
</script>

<template>
  <ProfileSection
    clearable
    title="Languages"
    icon="i-lucide-languages"
    testid="profile-languages"
    :empty="!languages.length"
    :count="count"
    empty-message="No languages yet."
    add-label="Add language"
    @clear="emit('clear')"
    @add="openForm(null)"
  >
    <ul class="space-y-2">
      <li
        v-for="l in languages"
        :key="l.id"
        class="flex items-center gap-2"
        data-testid="profile-language"
      >
        <span class="min-w-0 flex-1 truncate">{{ l.name }}</span>
        <UBadge color="neutral" variant="subtle" size="sm"
          >Spoken: {{ proficiencyLabel(l.spoken) }}</UBadge
        >
        <UBadge color="neutral" variant="subtle" size="sm"
          >Written: {{ proficiencyLabel(l.written) }}</UBadge
        >
        <ProfileRowActions
          v-if="!translating"
          :name="l.name"
          remove-label="Remove"
          testid="profile-language-actions"
          @edit="openForm(l)"
          @remove="removing = l"
        />
      </li>
    </ul>
  </ProfileSection>

  <!-- Outside the section: its body isn't rendered while the section is empty. -->
  <ProfileLanguageModal v-model:open="formOpen" :language="editing" @changed="emit('changed')" />
  <AppConfirmModal
    v-model:open="removeOpen"
    title="Remove this language?"
    :description="removing?.name"
    confirm-label="Remove"
    :loading="loading"
    @confirm="remove"
  />
</template>

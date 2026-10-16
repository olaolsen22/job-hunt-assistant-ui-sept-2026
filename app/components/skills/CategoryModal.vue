<script setup lang="ts">
import { LANGUAGE_OPTIONS, type Language } from '~/constants/listing'
import type { SkillCategory } from '~/composables/useSkillCategories'

// Without `category` it adds one (appended last); with it, it edits or deletes that one.
const { category } = defineProps<{ category: SkillCategory | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const CREATE = graphql(`
  mutation CreateSkillCategory($input: CreateSkillCategoryInput!) {
    createSkillCategory(input: $input) {
      skillCategory {
        id
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
const UPDATE = graphql(`
  mutation UpdateSkillCategory($input: UpdateSkillCategoryInput!) {
    updateSkillCategory(input: $input) {
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)
const DELETE = graphql(`
  mutation DeleteSkillCategory($input: DeleteSkillCategoryInput!) {
    deleteSkillCategory(input: $input) {
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)
const SET_TRANSLATION = graphql(`
  mutation SetSkillCategoryTranslation($input: SetSkillCategoryTranslationInput!) {
    setSkillCategoryTranslation(input: $input) {
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)
const DELETE_TRANSLATION = graphql(`
  mutation DeleteSkillCategoryTranslation($input: DeleteSkillCategoryTranslationInput!) {
    deleteSkillCategoryTranslation(input: $input) {
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
const description = ref('')
// One optional name per CV language; blank prints the main name.
const translations = ref<Record<Language, string>>({ ENGLISH: '', NORWEGIAN: '' })
const savedTranslation = (language: Language) =>
  category?.translations.find((t) => t.language === language)?.name ?? ''

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = category?.name ?? ''
  description.value = category?.description ?? ''
  for (const { value } of LANGUAGE_OPTIONS) translations.value[value] = savedTranslation(value)
})

const validate = () => formErrors({ name: requiredError(name.value, 'a name') })

// The modal stays open after a failed save, so the toast's message can be acted on.
const { run, loading } = useMutation(() => emit('changed'))

const submit = async () => {
  let saved = false
  const ok = await run(async () => {
    // Update is a full replace, so the description is always sent along with the name.
    const input = { name: name.value.trim(), description: description.value.trim() || null }
    let id = category?.id
    if (id == null) {
      const { createSkillCategory: payload } = await gql(CREATE, { input })
      if (payload.errors?.length) return payload.errors
      id = payload.skillCategory!.id
    } else {
      const { updateSkillCategory: payload } = await gql(UPDATE, { input: { id, ...input } })
      if (payload.errors?.length) return payload.errors
    }
    saved = true
    for (const { value: language } of LANGUAGE_OPTIONS) {
      const wanted = translations.value[language].trim()
      if (wanted === savedTranslation(language)) continue
      const errors = wanted
        ? (await gql(SET_TRANSLATION, { input: { categoryId: id, language, name: wanted } }))
            .setSkillCategoryTranslation.errors
        : (await gql(DELETE_TRANSLATION, { input: { categoryId: id, language } }))
            .deleteSkillCategoryTranslation.errors
      if (errors?.length) return errors
    }
    return null
  })
  // A failed translation still leaves the saved name and description, so the list refreshes.
  if (saved) emit('changed')
  if (ok) open.value = false
}

const deleteOpen = ref(false)
const { run: runDelete, loading: deleting } = useMutation(() => emit('changed'))
const remove = async () => {
  const ok = await runDelete(
    async () => (await gql(DELETE, { input: { id: category!.id } })).deleteSkillCategory.errors
  )
  if (!ok) return
  deleteOpen.value = false
  open.value = false
  emit('changed')
}

const deleteDescription = computed(() => {
  const count = category?.skillCount ?? 0
  const skills = count
    ? `Its ${count} ${count === 1 ? 'skill becomes' : 'skills become'} uncategorized; the skills themselves are kept. `
    : ''
  return `${skills}Tailored CVs that used it print those skills under Other.`
})
</script>

<template>
  <AppFormModal
    v-model:open="open"
    :title="category ? 'Edit category' : 'New category'"
    :state="{ name, description, translations }"
    :validate="validate"
    :loading="loading"
    @submit="submit"
  >
    <div class="space-y-4">
      <UFormField label="Name" name="name" required>
        <UInput v-model="name" maxlength="100" class="w-full" data-testid="category-name" />
      </UFormField>
      <UFormField
        label="Description"
        name="description"
        description="Used by AI when it sorts skills into categories."
      >
        <UTextarea
          v-model="description"
          :rows="2"
          autoresize
          maxlength="500"
          class="w-full"
          data-testid="category-description"
        />
      </UFormField>
      <UFormField
        v-for="l in LANGUAGE_OPTIONS"
        :key="l.value"
        :label="`Name on ${l.label} CVs`"
        :name="`translation-${l.value}`"
      >
        <UInput
          v-model="translations[l.value]"
          :placeholder="name || 'Same as the name'"
          maxlength="100"
          class="w-full"
          :data-testid="`category-translation-${l.value}`"
        />
      </UFormField>
    </div>

    <!-- Inside the form's modal rather than on each row, so a stray tap in the list can't start it. -->
    <template v-if="category" #after>
      <div class="mt-6 border-t border-default pt-4">
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          :disabled="loading"
          data-testid="category-delete"
          @click="deleteOpen = true"
          >Delete category</UButton
        >
      </div>
    </template>
  </AppFormModal>

  <AppConfirmModal
    v-model:open="deleteOpen"
    :title="`Delete ${category?.name}?`"
    :description="deleteDescription"
    confirm-label="Delete"
    color="error"
    :loading="deleting"
    @confirm="remove"
  />
</template>

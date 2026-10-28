<script setup lang="ts">
import { LANGUAGE_OPTIONS } from '~/constants/listing'
import type { ProfileEducation, ProfileExperience } from '~/composables/useProfile'

// The translated job title of an experience, or degree and field of an education, shown under
// the original while translating. Same row as a bullet translation. Pass one of the two.
const props = defineProps<{ experience?: ProfileExperience; education?: ProfileEducation }>()
const emit = defineEmits<{ changed: [] }>()

const SET_EXPERIENCE = graphql(`
  mutation SetProfileExperienceTranslation($input: SetProfileExperienceTranslationInput!) {
    setProfileExperienceTranslation(input: $input) {
      profileExperienceTranslation {
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
const SET_EDUCATION = graphql(`
  mutation SetProfileEducationTranslation($input: SetProfileEducationTranslationInput!) {
    setProfileEducationTranslation(input: $input) {
      profileEducationTranslation {
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
const DELETE_EXPERIENCE = graphql(`
  mutation DeleteProfileExperienceTranslation($input: DeleteProfileExperienceTranslationInput!) {
    deleteProfileExperienceTranslation(input: $input) {
      id
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)
const DELETE_EDUCATION = graphql(`
  mutation DeleteProfileEducationTranslation($input: DeleteProfileEducationTranslationInput!) {
    deleteProfileEducationTranslation(input: $input) {
      id
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

type FieldName = 'title' | 'degree' | 'field'
type Field = {
  name: FieldName
  label: string
  original: string
  translated: string | null
  source: string | null
  stale: boolean
}

const { target, editingKey, nextUntranslated } = useProfileTranslation()
const targetLabel = computed(() => LANGUAGE_OPTIONS.find((o) => o.value === target.value)!.label)
const targetCode = computed(() => (target.value === 'ENGLISH' ? 'EN' : 'NO'))
const key = computed(() =>
  props.experience
    ? translationKey('experience', props.experience.id)
    : translationKey('education', props.education!.id)
)

// One shape for both kinds; education only offers the fields its original has, since the API
// rejects translating a field that has no original.
const state = computed(() => {
  if (props.experience) {
    const t = props.experience.translations.find((x) => x.language === target.value)
    const fields: Field[] = [
      {
        name: 'title',
        label: 'Job title',
        original: props.experience.title,
        translated: t?.title ?? null,
        source: t?.sourceTitle ?? null,
        stale: !!t?.isStale
      }
    ]
    return { translation: t, fields, what: 'job title' }
  }
  const e = props.education!
  const t = e.translations.find((x) => x.language === target.value)
  const fields: Field[] = []
  if (e.degree)
    fields.push({
      name: 'degree',
      label: 'Degree',
      original: e.degree,
      translated: t?.degree ?? null,
      source: t?.sourceDegree ?? null,
      stale: !!t?.isDegreeStale
    })
  if (e.field)
    fields.push({
      name: 'field',
      label: 'Field of study',
      original: e.field,
      translated: t?.field ?? null,
      source: t?.sourceField ?? null,
      stale: !!t?.isFieldStale
    })
  return {
    translation: t,
    fields,
    what: fields.length > 1 ? 'degree and field' : fields[0]?.label.toLowerCase()
  }
})
const translation = computed(() => state.value.translation)
const fields = computed(() => state.value.fields)
const staleFields = computed(() => fields.value.filter((f) => f.stale))
const shown = computed(() =>
  fields.value
    .map((f) => f.translated)
    .filter(Boolean)
    .join(', ')
)
const name = computed(() => `${targetLabel.value} ${state.value.what}`)

const editing = computed({
  get: () => editingKey.value === key.value,
  set: (on: boolean) => (editingKey.value = on ? key.value : null)
})
const values = ref<Partial<Record<FieldName, string>>>({})
const showChanges = ref(false)
const deleteOpen = ref(false)
const empty = computed(() => fields.value.every((f) => !values.value[f.name]?.trim()))

const { run, loading } = useMutation(() => emit('changed'))

// Education is a full replace, so the form starts from what is saved and sends every field.
watch(
  editing,
  (on) => {
    if (on) values.value = Object.fromEntries(fields.value.map((f) => [f.name, f.translated ?? '']))
  },
  { immediate: true }
)

const text = (name: FieldName) => values.value[name]?.trim() || null

const save = async () => {
  if (empty.value) return
  const ok = await run(async () => {
    // A manual save is never machine-made, so it clears the "machine" badge.
    if (props.experience) {
      const { setProfileExperienceTranslation } = await gql(SET_EXPERIENCE, {
        input: {
          experienceId: props.experience.id,
          language: target.value,
          title: text('title')!,
          isMachine: false
        }
      })
      return setProfileExperienceTranslation.errors
    }
    const { setProfileEducationTranslation } = await gql(SET_EDUCATION, {
      input: {
        educationId: props.education!.id,
        language: target.value,
        degree: text('degree'),
        field: text('field'),
        isMachine: false
      }
    })
    return setProfileEducationTranslation.errors
  })
  if (!ok) return
  editingKey.value = nextUntranslated(key.value)
  emit('changed')
}

const remove = async () => {
  const id = translation.value!.id
  const ok = await run(async () => {
    if (props.experience) {
      const { deleteProfileExperienceTranslation } = await gql(DELETE_EXPERIENCE, {
        input: { id }
      })
      return deleteProfileExperienceTranslation.errors
    }
    const { deleteProfileEducationTranslation } = await gql(DELETE_EDUCATION, { input: { id } })
    return deleteProfileEducationTranslation.errors
  })
  deleteOpen.value = false
  if (ok) emit('changed')
}
</script>

<template>
  <div
    v-if="fields.length"
    class="mt-1 flex items-start gap-2"
    data-testid="profile-entry-translation"
  >
    <UBadge color="neutral" variant="outline" size="sm" class="mt-0.5 shrink-0">{{
      targetCode
    }}</UBadge>

    <form v-if="editing" class="min-w-0 flex-1 space-y-2" @submit.prevent="save">
      <UFormField
        v-for="(f, i) in fields"
        :key="f.name"
        :label="`${targetLabel} ${f.label.toLowerCase()}`"
        :help="`Original: ${f.original}`"
      >
        <UInput
          v-model="values[f.name]"
          :maxlength="200"
          :autofocus="i === 0"
          class="w-full"
          :data-testid="`profile-entry-translation-${f.name}`"
          @keydown.esc.stop.prevent="editing = false"
        />
      </UFormField>
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          type="submit"
          size="sm"
          :loading="loading"
          :disabled="empty"
          data-testid="profile-entry-translation-save"
          >Save</UButton
        >
        <UButton size="sm" color="neutral" variant="ghost" @click="editing = false">Cancel</UButton>
        <span v-if="empty && fields.length > 1" class="text-xs text-muted"
          >Fill in at least one.</span
        >
      </div>
    </form>

    <div v-else-if="translation" class="min-w-0 flex-1">
      <div class="flex items-start gap-1">
        <span class="min-w-0 flex-1 break-words py-0.5 text-sm">{{ shown }}</span>
        <ProfileRowActions
          :name="name"
          testid="profile-entry-translation-actions"
          @edit="editing = true"
          @remove="deleteOpen = true"
        />
      </div>
      <div v-if="staleFields.length || translation.isMachine" class="flex flex-wrap gap-1">
        <UBadge
          v-if="staleFields.length"
          color="warning"
          variant="subtle"
          size="sm"
          data-testid="profile-entry-translation-stale"
          >Stale</UBadge
        >
        <UBadge v-if="translation.isMachine" color="neutral" variant="subtle" size="sm"
          >Machine</UBadge
        >
        <UButton
          v-if="staleFields.length"
          size="xs"
          color="neutral"
          variant="link"
          data-testid="profile-entry-translation-changes"
          @click="showChanges = !showChanges"
          >{{ showChanges ? 'Hide changes' : 'Show changes' }}</UButton
        >
      </div>
      <!-- Per field: degree and field go stale on their own. -->
      <template v-if="showChanges">
        <div
          v-for="f in staleFields"
          :key="f.name"
          class="mt-1 grid gap-2 text-sm sm:grid-cols-2"
          data-testid="profile-entry-translation-diff"
        >
          <p>
            <span class="block text-xs text-muted">Previous {{ f.label.toLowerCase() }}</span
            >{{ f.source }}
          </p>
          <p>
            <span class="block text-xs text-muted">Current {{ f.label.toLowerCase() }}</span
            >{{ f.original }}
          </p>
        </div>
      </template>
      <AppConfirmModal
        v-model:open="deleteOpen"
        title="Delete this translation?"
        :description="shown"
        confirm-label="Delete"
        :loading="loading"
        @confirm="remove"
      />
    </div>

    <UButton
      v-else
      size="sm"
      color="neutral"
      variant="link"
      icon="i-lucide-plus"
      :aria-label="`Add ${name} translation of ${fields.map((f) => f.original).join(', ')}`"
      data-testid="profile-entry-translation-add"
      @click="editing = true"
      >Add {{ state.what }} translation</UButton
    >
  </div>
</template>

<script setup lang="ts">
import type { ProfileEducation } from '~/composables/useProfile'

const props = withDefaults(
  defineProps<{
    educations: readonly ProfileEducation[]
    defaultOpen?: boolean
    count?: number
  }>(),
  { defaultOpen: true, count: undefined }
)
const emit = defineEmits<{ changed: []; clear: [] }>()

const { locale, translating } = useProfileTranslation()

const DELETE_EDUCATION = graphql(`
  mutation DeleteProfileEducation($input: DeleteProfileEducationInput!) {
    deleteProfileEducation(input: $input) {
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

const formOpen = ref(false)
// By id, so the open form shows the refetched entry (its bullets save while it is open).
const editingId = ref<number | null>(null)
const editing = computed(() => props.educations.find((e) => e.id === editingId.value) ?? null)
const deleting = ref<ProfileEducation | null>(null)
const deleteOpen = computed({
  get: () => !!deleting.value,
  set: (value) => {
    if (!value) deleting.value = null
  }
})

const openForm = (entry: ProfileEducation | null) => {
  editingId.value = entry?.id ?? null
  formOpen.value = true
}

const { run, loading } = useMutation(() => emit('changed'))

const remove = async () => {
  const id = deleting.value!.id
  const ok = await run(async () => {
    const { deleteProfileEducation } = await gql(DELETE_EDUCATION, { input: { id } })
    return deleteProfileEducation.errors
  })
  deleting.value = null
  if (ok) emit('changed')
}
</script>

<template>
  <ProfileSection
    clearable
    title="Education"
    icon="i-lucide-graduation-cap"
    testid="profile-education"
    :empty="!educations.length"
    :default-open="defaultOpen"
    :count="count"
    empty-message="No education yet."
    add-label="Add education"
    @clear="emit('clear')"
    @add="openForm(null)"
  >
    <ul class="divide-y divide-default">
      <ProfileEntry
        v-for="e in educations"
        :key="e.id"
        kind="EDUCATION"
        :entry-id="e.id"
        :title="e.school"
        :subtitle="[e.degree, e.field].filter(Boolean).join(', ')"
        :dates="
          [
            formatMonthRange(e.startMonth, e.endMonth, 'Present', locale),
            e.location && formatLocation(e.location)
          ]
            .filter(Boolean)
            .join(' · ')
        "
        :bullets="e.bullets"
        @edit="openForm(e)"
        @delete="deleting = e"
        @changed="emit('changed')"
      >
        <template v-if="translating" #translation>
          <ProfileEntryTranslation :education="e" @changed="emit('changed')" />
        </template>
      </ProfileEntry>
    </ul>
  </ProfileSection>

  <!-- Outside the section: its body isn't rendered while the section is empty. -->
  <ProfileEducationModal v-model:open="formOpen" :education="editing" @changed="emit('changed')" />
  <AppConfirmModal
    v-model:open="deleteOpen"
    title="Delete this education?"
    :description="deleting ? `${deleting.school}, with its bullets.` : undefined"
    confirm-label="Delete"
    :loading="loading"
    @confirm="remove"
  />
</template>

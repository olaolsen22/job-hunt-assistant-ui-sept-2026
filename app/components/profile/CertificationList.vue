<script setup lang="ts">
import type { ProfileCertification } from '~/composables/useProfile'

const props = withDefaults(
  defineProps<{
    certifications: readonly ProfileCertification[]
    defaultOpen?: boolean
    count?: number
  }>(),
  { defaultOpen: true, count: undefined }
)
const emit = defineEmits<{ changed: []; clear: [] }>()

const { locale } = useProfileTranslation()

const DELETE_CERTIFICATION = graphql(`
  mutation DeleteProfileCertification($input: DeleteProfileCertificationInput!) {
    deleteProfileCertification(input: $input) {
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
const editing = computed(() => props.certifications.find((e) => e.id === editingId.value) ?? null)
const deleting = ref<ProfileCertification | null>(null)
const deleteOpen = computed({
  get: () => !!deleting.value,
  set: (value) => {
    if (!value) deleting.value = null
  }
})

const openForm = (entry: ProfileCertification | null) => {
  editingId.value = entry?.id ?? null
  formOpen.value = true
}

const { run, loading } = useMutation(() => emit('changed'))

const remove = async () => {
  const id = deleting.value!.id
  const ok = await run(async () => {
    const { deleteProfileCertification } = await gql(DELETE_CERTIFICATION, { input: { id } })
    return deleteProfileCertification.errors
  })
  deleting.value = null
  if (ok) emit('changed')
}
</script>

<template>
  <ProfileSection
    clearable
    title="Certifications"
    icon="i-lucide-award"
    testid="profile-certifications"
    :empty="!certifications.length"
    :default-open="defaultOpen"
    :count="count"
    empty-message="No certifications yet."
    add-label="Add certification"
    @clear="emit('clear')"
    @add="openForm(null)"
  >
    <ul class="divide-y divide-default">
      <ProfileEntry
        v-for="e in certifications"
        :key="e.id"
        kind="CERTIFICATION"
        :entry-id="e.id"
        :title="e.name"
        :subtitle="e.issuer"
        :dates="
          [
            e.issuedMonth && `Issued ${formatMonth(e.issuedMonth, locale)}`,
            e.expiresMonth && `Expires ${formatMonth(e.expiresMonth, locale)}`
          ]
            .filter(Boolean)
            .join(' · ')
        "
        :bullets="e.bullets"
        @edit="openForm(e)"
        @delete="deleting = e"
        @changed="emit('changed')"
      >
        <p v-if="e.url" class="text-sm">
          <ULink :to="e.url" target="_blank" class="text-primary">Credential</ULink>
        </p>
      </ProfileEntry>
    </ul>
  </ProfileSection>

  <!-- Outside the section: its body isn't rendered while the section is empty. -->
  <ProfileCertificationModal
    v-model:open="formOpen"
    :certification="editing"
    @changed="emit('changed')"
  />
  <AppConfirmModal
    v-model:open="deleteOpen"
    title="Delete this certification?"
    :description="deleting ? `${deleting.name}, with its bullets.` : undefined"
    confirm-label="Delete"
    :loading="loading"
    @confirm="remove"
  />
</template>

<script setup lang="ts">
import type { ProfileCertification } from '~/composables/useProfile'

defineProps<{ certifications: readonly ProfileCertification[] }>()
const emit = defineEmits<{ changed: [] }>()

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
const editing = ref<ProfileCertification | null>(null)
const deleting = ref<ProfileCertification | null>(null)
const deleteOpen = computed({
  get: () => !!deleting.value,
  set: (value) => {
    if (!value) deleting.value = null
  }
})

const openForm = (entry: ProfileCertification | null) => {
  editing.value = entry
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
    title="Certifications"
    icon="i-lucide-award"
    testid="profile-certifications"
    :empty="!certifications.length"
    empty-message="No certifications yet."
    add-label="Add certification"
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
            e.issuedMonth && `Issued ${formatMonth(e.issuedMonth)}`,
            e.expiresMonth && `Expires ${formatMonth(e.expiresMonth)}`
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

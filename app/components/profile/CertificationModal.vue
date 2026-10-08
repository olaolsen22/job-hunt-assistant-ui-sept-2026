<script setup lang="ts">
import type { ProfileCertification } from '~/composables/useProfile'

// Without `certification` it adds one; with it, it edits that one. Bullets are edited on the card.
const { certification } = defineProps<{ certification: ProfileCertification | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const ADD_CERTIFICATION = graphql(`
  mutation AddProfileCertification($input: AddProfileCertificationInput!) {
    addProfileCertification(input: $input) {
      profileCertification {
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

const UPDATE_CERTIFICATION = graphql(`
  mutation UpdateProfileCertification($input: UpdateProfileCertificationInput!) {
    updateProfileCertification(input: $input) {
      profileCertification {
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

const name = ref('')
const issuer = ref('')
const issuedMonth = ref<string | null>(null)
const expiresMonth = ref<string | null>(null)
const url = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = certification?.name ?? ''
  issuer.value = certification?.issuer ?? ''
  issuedMonth.value = certification?.issuedMonth ?? null
  expiresMonth.value = certification?.expiresMonth ?? null
  url.value = certification?.url ?? ''
})

const { run, loading } = useMutation(() => emit('changed'))

const submit = async () => {
  const fields = {
    name: name.value.trim(),
    issuer: issuer.value.trim() || null,
    issuedMonth: issuedMonth.value,
    expiresMonth: expiresMonth.value,
    url: url.value.trim() || null
  }
  const ok = await run(async () => {
    if (certification) {
      const { updateProfileCertification } = await gql(UPDATE_CERTIFICATION, {
        input: { id: certification.id, ...fields }
      })
      return updateProfileCertification.errors
    }
    const { addProfileCertification } = await gql(ADD_CERTIFICATION, { input: fields })
    return addProfileCertification.errors
  })
  if (!ok) return
  open.value = false
  emit('changed')
}
</script>

<template>
  <AppConfirmModal
    v-model:open="open"
    :title="certification ? 'Edit certification' : 'Add certification'"
    confirm-label="Save"
    :loading="loading"
    :disabled="!name.trim()"
    @confirm="submit"
  >
    <div class="space-y-4">
      <UFormField label="Name" required>
        <UInput v-model="name" class="w-full" />
      </UFormField>
      <UFormField label="Issuer">
        <UInput v-model="issuer" class="w-full" />
      </UFormField>
      <UFormField label="Issued">
        <AppMonthField v-model="issuedMonth" />
      </UFormField>
      <UFormField label="Expires">
        <AppMonthField v-model="expiresMonth" />
      </UFormField>
      <UFormField label="URL">
        <UInput v-model="url" placeholder="https://" class="w-full" />
      </UFormField>
    </div>
  </AppConfirmModal>
</template>

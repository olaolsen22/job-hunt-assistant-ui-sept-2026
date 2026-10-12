<script setup lang="ts">
import type { ProfileCertification } from '~/composables/useProfile'

// Without `certification` it adds one; with it, it edits that one. Its bullets save on their own.
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
const issuedPartial = ref(false)
const expiresPartial = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = certification?.name ?? ''
  issuer.value = certification?.issuer ?? ''
  issuedMonth.value = certification?.issuedMonth ?? null
  expiresMonth.value = certification?.expiresMonth ?? null
  url.value = certification?.url ?? ''
})

const state = computed(() => ({
  name: name.value,
  issuer: issuer.value,
  issuedMonth: issuedMonth.value,
  expiresMonth: expiresMonth.value,
  url: url.value
}))

const validate = () =>
  formErrors({
    name: requiredError(name.value, 'a name'),
    issuedMonth: monthError(issuedMonth.value, issuedPartial.value),
    expiresMonth: monthError(expiresMonth.value, expiresPartial.value)
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
  <AppFormModal
    v-model:open="open"
    :title="certification ? 'Edit certification' : 'Add certification'"
    :state="state"
    :validate="validate"
    :loading="loading"
    @submit="submit"
  >
    <div class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Name" name="name" required>
          <UInput v-model="name" class="w-full" data-testid="certification-name" />
        </UFormField>
        <UFormField label="Issuer">
          <UInput v-model="issuer" class="w-full" />
        </UFormField>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Issued" name="issuedMonth">
          <AppMonthField v-model="issuedMonth" v-model:partial="issuedPartial" />
        </UFormField>
        <UFormField label="Expires" name="expiresMonth">
          <AppMonthField v-model="expiresMonth" v-model:partial="expiresPartial" />
        </UFormField>
      </div>
      <UFormField label="URL">
        <UInput v-model="url" placeholder="https://" class="w-full" />
      </UFormField>
    </div>

    <template #after>
      <ProfileEntryBullets
        kind="CERTIFICATION"
        :entry="certification"
        class="mt-6 border-t border-default pt-4"
        @changed="emit('changed')"
      />
    </template>
  </AppFormModal>
</template>

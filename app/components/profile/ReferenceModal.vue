<script setup lang="ts">
import type { ProfileReference } from '~/composables/useProfile'

// Without `reference` it adds one; with it, it edits that one.
const { reference } = defineProps<{ reference: ProfileReference | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const ADD_REFERENCE = graphql(`
  mutation AddProfileReference($input: AddProfileReferenceInput!) {
    addProfileReference(input: $input) {
      profileReference {
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

const UPDATE_REFERENCE = graphql(`
  mutation UpdateProfileReference($input: UpdateProfileReferenceInput!) {
    updateProfileReference(input: $input) {
      profileReference {
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
const relationship = ref('')
const company = ref('')
const email = ref('')
const phone = ref('')
const note = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = reference?.name ?? ''
  relationship.value = reference?.relationship ?? ''
  company.value = reference?.company ?? ''
  email.value = reference?.email ?? ''
  phone.value = reference?.phone ?? ''
  note.value = reference?.note ?? ''
})

const { run, loading } = useMutation(() => emit('changed'))

const submit = async () => {
  const fields = {
    name: name.value.trim(),
    relationship: relationship.value.trim(),
    company: company.value.trim() || null,
    email: email.value.trim() || null,
    phone: phone.value.trim() || null,
    note: note.value.trim() || null
  }
  const ok = await run(async () => {
    if (reference) {
      const { updateProfileReference } = await gql(UPDATE_REFERENCE, {
        input: { id: reference.id, ...fields }
      })
      return updateProfileReference.errors
    }
    const { addProfileReference } = await gql(ADD_REFERENCE, { input: fields })
    return addProfileReference.errors
  })
  if (!ok) return
  open.value = false
  emit('changed')
}
</script>

<template>
  <AppConfirmModal
    v-model:open="open"
    :title="reference ? 'Edit reference' : 'Add reference'"
    confirm-label="Save"
    :loading="loading"
    :disabled="!name.trim() || !relationship.trim()"
    @confirm="submit"
  >
    <div class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Name" required>
          <UInput v-model="name" class="w-full" data-testid="reference-name" />
        </UFormField>
        <UFormField label="Relationship" required>
          <UInput
            v-model="relationship"
            placeholder="Former manager"
            class="w-full"
            data-testid="reference-relationship"
          />
        </UFormField>
      </div>
      <UFormField label="Company">
        <UInput v-model="company" class="w-full" />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Email">
          <UInput v-model="email" type="email" class="w-full" />
        </UFormField>
        <UFormField label="Phone">
          <UInput v-model="phone" type="tel" class="w-full" />
        </UFormField>
      </div>
      <UFormField label="Note">
        <UTextarea v-model="note" :rows="2" autoresize class="w-full" />
      </UFormField>
    </div>
  </AppConfirmModal>
</template>

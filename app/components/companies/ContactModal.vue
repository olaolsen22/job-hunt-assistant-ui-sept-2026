<script setup lang="ts">
import type { CompanyContact } from '~/composables/contactFields'

// Without `contact` it adds one to the company; with it, it replaces that one's fields.
const { companyId, contact } = defineProps<{ companyId: number; contact: CompanyContact | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const ADD_CONTACT = graphql(`
  mutation AddContact($input: AddContactInput!) {
    addContact(input: $input) {
      contact {
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

const UPDATE_CONTACT = graphql(`
  mutation UpdateContact($input: UpdateContactInput!) {
    updateContact(input: $input) {
      contact {
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

const form = reactive({ name: '', title: '', email: '', phone: '', url: '', notes: '' })

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(form, {
    name: contact?.name ?? '',
    title: contact?.title ?? '',
    email: contact?.email ?? '',
    phone: contact?.phone ?? '',
    url: contact?.url ?? '',
    notes: contact?.notes ?? ''
  })
})

const { run, loading } = useMutation(() => emit('changed'))

const submit = async () => {
  // The API wants null, not "", for empty optional fields.
  const fields = Object.fromEntries(
    Object.entries(form).map(([k, v]) => [k, v.trim() || null])
  ) as Record<keyof typeof form, string | null>
  const input = { ...fields, name: form.name.trim() }
  const ok = await run(async () => {
    if (contact) {
      const { updateContact } = await gql(UPDATE_CONTACT, {
        input: { id: contact.id, contact: input }
      })
      return updateContact.errors
    }
    const { addContact } = await gql(ADD_CONTACT, { input: { companyId, contact: input } })
    return addContact.errors
  })
  if (!ok) return
  open.value = false
  emit('changed')
}
</script>

<template>
  <AppConfirmModal
    v-model:open="open"
    :title="contact ? 'Edit contact' : 'Add contact'"
    confirm-label="Save"
    :loading="loading"
    :disabled="!form.name.trim()"
    @confirm="submit"
  >
    <div class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Name" required>
          <UInput v-model="form.name" class="w-full" data-testid="contact-name" />
        </UFormField>
        <UFormField label="Title">
          <UInput v-model="form.title" placeholder="Recruiter" class="w-full" />
        </UFormField>
        <UFormField label="Email">
          <UInput v-model="form.email" type="email" class="w-full" data-testid="contact-email" />
        </UFormField>
        <UFormField label="Phone">
          <UInput v-model="form.phone" type="tel" class="w-full" />
        </UFormField>
      </div>
      <UFormField label="Link">
        <UInput v-model="form.url" type="url" placeholder="https://" class="w-full" />
      </UFormField>
      <AppMarkdownEditor v-model="form.notes" label="Notes" />
    </div>
  </AppConfirmModal>
</template>

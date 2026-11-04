<script setup lang="ts">
import type { ContactInteraction } from '~/composables/contactFields'
import {
  CONTACT_CHANNEL_OPTIONS,
  CONTACT_DIRECTION_OPTIONS,
  type ContactChannel,
  type ContactDirection
} from '~/constants/contact'

// Without `interaction` it logs a new one; with it, it replaces that one (the API's update is a
// full replace, so every field is sent).
const { contactId, interaction } = defineProps<{
  contactId: number
  interaction: ContactInteraction | null
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const ADD_INTERACTION = graphql(`
  mutation AddContactInteraction($input: AddContactInteractionInput!) {
    addContactInteraction(input: $input) {
      contactInteraction {
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

const UPDATE_INTERACTION = graphql(`
  mutation UpdateContactInteraction($input: UpdateContactInteractionInput!) {
    updateContactInteraction(input: $input) {
      contactInteraction {
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

const form = reactive({
  direction: 'SENT' as ContactDirection,
  channel: 'EMAIL' as ContactChannel,
  occurredAt: '',
  note: '',
  followUpOn: ''
})

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(form, {
    direction: interaction?.direction ?? 'SENT',
    channel: interaction?.channel ?? 'EMAIL',
    occurredAt: toDateTimeLocal(interaction?.occurredAt),
    note: interaction?.note ?? '',
    followUpOn: interaction?.followUpOn ?? ''
  })
})

// Local YYYY-MM-DD `days` from today.
const inDays = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}
const QUICK_PICKS = [
  { label: '+3 days', days: 3 },
  { label: '+1 week', days: 7 },
  { label: '+2 weeks', days: 14 }
]

// The API's two rules, checked here so they show beside their fields. datetime-local values are
// local time and ISO-shaped, so the first 10 characters are the local date.
const now = ref(toDateTimeLocal())
watch(open, () => (now.value = toDateTimeLocal()))
const occurredDate = computed(() => form.occurredAt.slice(0, 10))
const occurredError = computed(() =>
  form.occurredAt && new Date(form.occurredAt) > new Date() ? 'Can’t be in the future' : undefined
)
const followUpError = computed(() =>
  form.followUpOn && form.followUpOn < occurredDate.value
    ? 'Can’t be before the interaction'
    : undefined
)

const { run, loading } = useMutation(() => emit('changed'))

const submit = async () => {
  const input = {
    occurredAt: new Date(form.occurredAt).toISOString(),
    direction: form.direction,
    channel: form.channel,
    note: form.note.trim() || null,
    followUpOn: form.followUpOn || null
  }
  const ok = await run(async () => {
    if (interaction) {
      const { updateContactInteraction } = await gql(UPDATE_INTERACTION, {
        input: { id: interaction.id, interaction: input }
      })
      return updateContactInteraction.errors
    }
    const { addContactInteraction } = await gql(ADD_INTERACTION, {
      input: { contactId, interaction: input }
    })
    return addContactInteraction.errors
  })
  if (!ok) return
  open.value = false
  emit('changed')
}
</script>

<template>
  <AppConfirmModal
    v-model:open="open"
    :title="interaction ? 'Edit interaction' : 'Log interaction'"
    :confirm-label="interaction ? 'Save changes' : 'Log interaction'"
    :loading="loading"
    :disabled="!form.occurredAt || !!occurredError || !!followUpError"
    @confirm="submit"
  >
    <div class="space-y-4">
      <UFormField label="Direction">
        <ListingsToggleGroup
          v-model="form.direction"
          :options="CONTACT_DIRECTION_OPTIONS"
          :clearable="false"
          data-testid="interaction-direction"
        />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Channel">
          <USelect
            v-model="form.channel"
            :items="[...CONTACT_CHANNEL_OPTIONS]"
            class="w-full"
            data-testid="interaction-channel"
          />
        </UFormField>
        <UFormField label="When" required :error="occurredError">
          <UInput
            v-model="form.occurredAt"
            type="datetime-local"
            :max="now"
            class="w-full"
            data-testid="interaction-occurred-at"
          />
        </UFormField>
      </div>
      <AppMarkdownEditor v-model="form.note" label="Note" />
      <UFormField
        label="Follow up by"
        help="Leave empty if nothing is pending. This clears the current follow-up."
        :error="followUpError"
      >
        <div class="space-y-2">
          <UInput
            v-model="form.followUpOn"
            type="date"
            :min="occurredDate"
            class="w-full"
            data-testid="interaction-follow-up"
          />
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="p in QUICK_PICKS"
              :key="p.days"
              color="neutral"
              variant="subtle"
              size="xs"
              @click="form.followUpOn = inDays(p.days)"
              >{{ p.label }}</UButton
            >
            <UButton
              v-if="form.followUpOn"
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-x"
              @click="form.followUpOn = ''"
              >Clear</UButton
            >
          </div>
        </div>
      </UFormField>
    </div>
  </AppConfirmModal>
</template>

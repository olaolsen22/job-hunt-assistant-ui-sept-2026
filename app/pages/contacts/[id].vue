<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import {
  DELETE_CONTACT,
  INTERACTION_FIELDS,
  type ContactInteraction
} from '~/composables/contactFields'
import { useContactsView } from '~/composables/useListingsList'
import { ERROR_MESSAGES } from '~/constants/errorMessages'

definePageMeta({ title: 'Person' })

// Listings linked to this person (open applications, or ads naming them) come in the same request.
const CONTACT_PAGE = graphql(
  `
    query ContactPage($id: Int!) {
      contactById(id: $id) {
        ...ContactFields
        company {
          id
          name
        }
        interactions(order: [{ occurredAt: DESC }]) {
          ...InteractionFields
        }
      }
      listings(take: 20, where: { contacts: { some: { contactId: { eq: $id } } } }) {
        items {
          id
          title
          status
          jobRole {
            name
          }
        }
      }
    }
  `,
  [CONTACT_FIELDS, INTERACTION_FIELDS]
)

const DELETE_INTERACTION = graphql(`
  mutation DeleteContactInteraction($input: DeleteContactInteractionInput!) {
    deleteContactInteraction(input: $input) {
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

const route = useRoute()
const id = Number(route.params.id)
const contactsView = useContactsView()

const { data, status, error, refresh } = await useAsyncData(
  `contact-${id}`,
  () => gql(CONTACT_PAGE, { id }),
  { server: false }
)
const contact = computed(() => data.value?.contactById ?? null)
const listings = computed(() => data.value?.listings?.items ?? [])
const loading = computed(() => status.value === 'pending')

const { success: toastSuccess } = useAppToast()
const editOpen = ref(false)
const deleteOpen = ref(false)
const openApplication = computed(() => `/listings/add?contact=${id}`)

const moreItems = computed<DropdownMenuItem[]>(() => [
  { label: 'Start open application', icon: 'i-lucide-send', to: openApplication.value },
  { type: 'separator' },
  {
    label: 'Delete',
    icon: 'i-lucide-trash-2',
    color: 'error',
    onSelect: () => (deleteOpen.value = true)
  }
])

const { run: runDelete, loading: deleting } = useMutation(refresh)
const deleteContact = async () => {
  const ok = await runDelete(async () => {
    const { deleteContact } = await gql(DELETE_CONTACT, { input: { id } })
    return deleteContact.errors
  })
  deleteOpen.value = false
  if (!ok) return
  toastSuccess('Person deleted')
  await navigateTo(contactsView.value, { replace: true })
}

// Logging, editing and deleting all refetch the contact: its follow-up date and last contact come
// from the latest interaction, so the API decides them.
const interactionOpen = ref(false)
const editingInteraction = ref<ContactInteraction | null>(null)
const openInteraction = (interaction: ContactInteraction | null) => {
  editingInteraction.value = interaction
  interactionOpen.value = true
}

const deletingInteraction = ref<ContactInteraction | null>(null)
const deleteInteractionOpen = computed({
  get: () => deletingInteraction.value != null,
  set: (isOpen) => {
    if (!isOpen) deletingInteraction.value = null
  }
})
const { run: runDeleteInteraction, loading: deletingInteractionLoading } = useMutation(refresh)
const deleteInteraction = async () => {
  const interaction = deletingInteraction.value!
  const ok = await runDeleteInteraction(async () => {
    const { deleteContactInteraction } = await gql(DELETE_INTERACTION, {
      input: { id: interaction.id }
    })
    return deleteContactInteraction.errors
  })
  deletingInteraction.value = null
  if (ok) await refresh()
}
</script>

<template>
  <div class="flex justify-center">
    <div class="w-full max-w-3xl space-y-4 sm:space-y-6 lg:max-w-6xl">
      <div class="flex items-center justify-between gap-2">
        <UButton
          :to="contactsView"
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          class="self-start"
        >
          People
        </UButton>

        <div v-if="contact" class="flex items-center gap-2">
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="subtle"
            data-testid="contact-edit"
            @click="editOpen = true"
            >Edit</UButton
          >
          <UDropdownMenu :items="moreItems" :content="{ align: 'end' }">
            <UButton
              icon="i-lucide-ellipsis-vertical"
              color="neutral"
              variant="subtle"
              aria-label="More actions"
              :loading="deleting"
              data-testid="contact-more"
            />
          </UDropdownMenu>
        </div>
      </div>

      <UAlert v-if="error" color="error" :description="ERROR_MESSAGES.generic" />

      <UAlert
        v-else-if="!loading && !contact"
        color="error"
        title="Person not found"
        data-testid="contact-not-found"
      />

      <div v-else-if="loading && !contact" class="space-y-4">
        <USkeleton class="h-24 w-full" />
        <div class="grid gap-4 lg:grid-cols-3">
          <USkeleton class="h-64 w-full lg:col-span-2" />
          <USkeleton class="h-32 w-full" />
        </div>
      </div>

      <template v-else-if="contact">
        <header class="space-y-2" data-testid="contact-header">
          <h1 class="break-words text-xl font-semibold text-highlighted">{{ contact.name }}</h1>
          <p class="text-muted">
            <template v-if="contact.title">{{ contact.title }} at </template>
            <NuxtLink
              :to="`/companies/${contact.company.id}`"
              class="font-medium text-default hover:underline"
              >{{ contact.company.name }}</NuxtLink
            >
          </p>
          <div v-if="contact.email || contact.phone || contact.url" class="flex flex-wrap gap-x-4">
            <UButton
              v-if="contact.email"
              :to="`mailto:${contact.email}`"
              icon="i-lucide-mail"
              color="neutral"
              variant="link"
              class="min-w-0 break-all px-0"
              >{{ contact.email }}</UButton
            >
            <UButton
              v-if="contact.phone"
              :to="`tel:${contact.phone}`"
              icon="i-lucide-phone"
              color="neutral"
              variant="link"
              class="px-0"
              >{{ contact.phone }}</UButton
            >
            <UButton
              v-if="contact.url"
              :to="contact.url"
              target="_blank"
              icon="i-lucide-external-link"
              color="neutral"
              variant="link"
              class="px-0"
              >Profile</UButton
            >
          </div>
          <div class="flex flex-wrap items-center gap-2 text-sm text-muted">
            <ContactsFollowUpChip v-if="contact.followUpOn" :follow-up-on="contact.followUpOn" />
            <span v-else data-testid="contact-no-follow-up">No follow-up set</span>
            <span v-if="contact.lastInteractionAt"
              >· Last contacted {{ daysAgoLabel(contact.lastInteractionAt) }}</span
            >
          </div>
        </header>

        <div class="grid items-start gap-4 lg:grid-cols-3">
          <AppCard title="Interactions" class="lg:col-span-2">
            <template #actions>
              <UButton
                v-if="contact.interactions.length"
                icon="i-lucide-plus"
                size="sm"
                data-testid="interaction-add"
                @click="openInteraction(null)"
                >Log interaction</UButton
              >
            </template>
            <ContactsInteractionList
              v-if="contact.interactions.length"
              :interactions="contact.interactions"
              @edit="openInteraction"
              @delete="deletingInteraction = $event"
            />
            <div
              v-else
              class="flex flex-col items-center justify-center gap-3 py-8 text-center"
              data-testid="interactions-empty"
            >
              <UIcon name="i-lucide-message-square" class="size-10 text-muted" />
              <p>Nothing logged yet. Log a message, call or meeting to track replies.</p>
              <UButton
                icon="i-lucide-plus"
                data-testid="interaction-add"
                @click="openInteraction(null)"
                >Log interaction</UButton
              >
            </div>
          </AppCard>

          <div class="space-y-4">
            <AppCard title="Listings">
              <div v-if="listings.length" class="space-y-1" data-testid="contact-listings">
                <DashboardRow
                  v-for="l in listings"
                  :id="l.id"
                  :key="l.id"
                  :title="l.title"
                  :subtitle="l.jobRole.name"
                >
                  <ListingsStatusBadge :status="l.status" />
                </DashboardRow>
              </div>
              <div
                v-else
                class="flex flex-col items-center justify-center gap-3 py-6 text-center"
                data-testid="contact-listings-empty"
              >
                <UIcon name="i-lucide-briefcase" class="size-10 text-muted" />
                <p>No applications to {{ contact.name }} yet.</p>
                <UButton :to="openApplication" color="neutral" variant="subtle" icon="i-lucide-send"
                  >Start open application</UButton
                >
              </div>
            </AppCard>

            <AppCard v-if="contact.notes" title="Notes">
              <LazyAppMarkdownContent :source="contact.notes" />
            </AppCard>
          </div>
        </div>

        <CompaniesContactModal
          v-model:open="editOpen"
          :company-id="contact.companyId"
          :contact="contact"
          @changed="refresh"
        />

        <ContactsInteractionModal
          v-model:open="interactionOpen"
          :contact-id="contact.id"
          :interaction="editingInteraction"
          @changed="refresh"
        />

        <AppConfirmModal
          v-model:open="deleteInteractionOpen"
          title="Delete this interaction?"
          description="The follow-up date and last contact are recalculated from what's left."
          confirm-label="Delete"
          :loading="deletingInteractionLoading"
          @confirm="deleteInteraction"
        />

        <AppConfirmModal
          v-model:open="deleteOpen"
          title="Delete this person?"
          :description="`${contact.name} and their logged interactions. Listings linked to them are kept.`"
          confirm-label="Delete"
          color="error"
          :loading="deleting"
          @confirm="deleteContact"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ResultOf } from 'gql.tada'
import type { CompanyContact } from '~/composables/contactFields'
import { ERROR_MESSAGES } from '~/constants/errorMessages'

definePageMeta({ title: 'Company' })

const route = useRoute()
const id = Number(route.params.id)
const companiesView = useCompaniesView()

// There is no single-company query, so the list is filtered to one id. Both listing fields are in
// the same request to avoid a waterfall; archived ones need their own field (`archived: true`).
// `take: 50` is a literal like the other lists (the cost check rejects a variable), and far more
// than one company ever gets.
const COMPANY_PAGE = graphql(
  `
    query CompanyPage($id: Int!) {
      companies(where: { id: { eq: $id } }, first: 1) {
        nodes {
          id
          name
          favoritedAt
          avoidedAt
          notes
          applicationCount
          contacts {
            ...ContactFields
          }
          industry {
            name
          }
          locations {
            location {
              id
              city
              countryCode
              isTarget
            }
          }
        }
      }
      open: listings(take: 50, where: { companyId: { eq: $id } }) {
        items {
          id
          title
          status
          archivedAt
          jobRole {
            name
          }
          locations {
            location {
              id
            }
          }
        }
      }
      archived: listings(take: 50, archived: true, where: { companyId: { eq: $id } }) {
        items {
          id
          title
          status
          archivedAt
          jobRole {
            name
          }
          locations {
            location {
              id
            }
          }
        }
      }
    }
  `,
  [CONTACT_FIELDS]
)

const DELETE_CONTACT = graphql(`
  mutation DeleteContact($input: DeleteContactInput!) {
    deleteContact(input: $input) {
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

const SET_AVOIDED = graphql(`
  mutation SetCompanyAvoided($input: SetCompanyAvoidedInput!) {
    setCompanyAvoided(input: $input) {
      company {
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

// Client-only (`server: false`) since it needs the session cookie.
const { data, status, error, refresh } = await useAsyncData(
  `company-${id}`,
  () => gql(COMPANY_PAGE, { id }),
  { server: false }
)

const company = computed(() => data.value?.companies?.nodes?.[0] ?? null)
const loading = computed(() => status.value === 'pending')

const IN_PROGRESS = ['APPLIED', 'INTERVIEWING', 'OFFER']
// In progress first, then Saved, then finished; archived ones last whatever their status.
const rank = (p: Position) =>
  p.archivedAt ? 3 : IN_PROGRESS.includes(p.status) ? 0 : p.status === 'SAVED' ? 1 : 2

type Position = NonNullable<NonNullable<ResultOf<typeof COMPANY_PAGE>['open']>['items']>[number]
const positions = computed(() =>
  [...(data.value?.open?.items ?? []), ...(data.value?.archived?.items ?? [])].sort(
    (a, b) => rank(a) - rank(b)
  )
)

// Counted from current statuses (archived included); a listing rejected after an interview counts
// as rejected, since per-listing history isn't fetched.
const stats = computed(() => {
  const count = (statuses: string[]) =>
    positions.value.filter((p) => statuses.includes(p.status)).length
  return [
    { label: 'Listings', value: positions.value.length },
    { label: 'Applications', value: company.value?.applicationCount ?? 0 },
    { label: 'In progress', value: count(IN_PROGRESS) },
    { label: 'Interviewed', value: count(['INTERVIEWING', 'OFFER', 'ACCEPTED']) },
    { label: 'Offers', value: count(['OFFER', 'ACCEPTED']) },
    { label: 'Rejected', value: count(['REJECTED']) }
  ]
})

// Each company location with how many of its listings (archived included) are there.
// Preferred (target) locations first, then the busiest, then by name.
const locations = computed(() =>
  (company.value?.locations ?? [])
    .map(({ location: l }) => ({
      id: l.id,
      label: formatLocation(l),
      isTarget: l.isTarget,
      listingCount: positions.value.filter((p) =>
        p.locations.some(({ location }) => location.id === l.id)
      ).length
    }))
    .sort(
      (a, b) =>
        Number(b.isTarget) - Number(a.isTarget) ||
        b.listingCount - a.listingCount ||
        a.label.localeCompare(b.label)
    )
)

const toast = useToast()
const notesOpen = ref(false)
const avoidOpen = ref(false)
const { run: runAvoid, loading: avoiding } = useMutation(refresh)

const setAvoided = async (isAvoided: boolean) => {
  const ok = await runAvoid(async () => {
    const { setCompanyAvoided } = await gql(SET_AVOIDED, { input: { id, isAvoided } })
    return setCompanyAvoided.errors
  })
  avoidOpen.value = false
  if (!ok) return
  await refresh()
  toast.add({ title: isAvoided ? 'Company avoided' : 'No longer avoided', color: 'success' })
}

const contacts = computed(() =>
  [...(company.value?.contacts ?? [])].sort((a, b) => a.name.localeCompare(b.name))
)
const contactFormOpen = ref(false)
const editingContact = ref<CompanyContact | null>(null)
const deletingContact = ref<CompanyContact | null>(null)
const deleteContactOpen = computed({
  get: () => deletingContact.value != null,
  set: (isOpen) => {
    if (!isOpen) deletingContact.value = null
  }
})
const { run: runDeleteContact, loading: deletingContactLoading } = useMutation(refresh)

const openContactForm = (contact: CompanyContact | null) => {
  editingContact.value = contact
  contactFormOpen.value = true
}

const deleteContact = async () => {
  const contact = deletingContact.value!
  const ok = await runDeleteContact(async () => {
    const { deleteContact } = await gql(DELETE_CONTACT, { input: { id: contact.id } })
    return deleteContact.errors
  })
  deletingContact.value = null
  if (ok) await refresh()
}

// Avoiding is rare, so it lives in the menu and Edit stays the one primary button.
const moreItems = computed<DropdownMenuItem[]>(() =>
  company.value?.avoidedAt
    ? [{ label: 'Stop avoiding', icon: 'i-lucide-circle-check', onSelect: () => setAvoided(false) }]
    : [{ label: 'Avoid company', icon: 'i-lucide-ban', onSelect: () => (avoidOpen.value = true) }]
)
</script>

<template>
  <div class="flex justify-center">
    <div class="w-full max-w-3xl space-y-4 sm:space-y-6 lg:max-w-6xl">
      <!-- Stacked below sm so Back never shares a line with the actions on a phone. -->
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <UButton
          :to="companiesView"
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          class="self-start"
        >
          Back
        </UButton>

        <div v-if="company" class="flex items-center gap-2">
          <UButton :to="`/companies/${company.id}/edit`" icon="i-lucide-pencil">Edit</UButton>
          <UDropdownMenu :items="moreItems" :content="{ align: 'end' }">
            <UButton
              icon="i-lucide-ellipsis-vertical"
              color="neutral"
              variant="subtle"
              aria-label="More actions"
              :loading="avoiding"
              data-testid="company-more"
            />
          </UDropdownMenu>
        </div>
      </div>

      <UAlert v-if="error" color="error" :description="ERROR_MESSAGES.generic" />

      <UAlert
        v-else-if="!loading && !company"
        color="error"
        title="Company not found"
        data-testid="company-not-found"
      />

      <!-- Only on first load: refreshes after an action keep the page (and its modals) mounted. -->
      <div v-else-if="loading && !company" class="space-y-4" data-testid="company-loading">
        <USkeleton class="h-24 w-full" />
        <USkeleton class="h-20 w-full" />
        <div class="grid gap-4 lg:grid-cols-3">
          <USkeleton class="h-64 w-full lg:col-span-2" />
          <div class="space-y-4">
            <USkeleton class="h-32 w-full" />
            <USkeleton class="h-40 w-full" />
          </div>
        </div>
      </div>

      <template v-else-if="company">
        <UAlert
          v-if="company.avoidedAt"
          color="warning"
          variant="subtle"
          icon="i-lucide-ban"
          title="You're avoiding this company"
          description="Its listings stay visible with an Avoided company badge."
          :actions="[
            {
              label: 'Stop avoiding',
              color: 'neutral',
              variant: 'outline',
              loading: avoiding,
              onClick: () => setAvoided(false)
            }
          ]"
          data-testid="company-avoided-notice"
        />

        <header class="space-y-3" data-testid="company-header">
          <div class="flex items-start justify-between gap-2">
            <h1 class="min-w-0 break-words text-xl font-semibold text-highlighted">
              {{ company.name }}
            </h1>
            <CompaniesFavoriteButton
              :id="company.id"
              :favorited-at="company.favoritedAt"
              size="md"
              class="shrink-0"
            />
          </div>

          <div v-if="company.industry || company.avoidedAt" class="flex flex-wrap gap-2">
            <UBadge
              v-if="company.industry"
              color="neutral"
              variant="subtle"
              size="lg"
              icon="i-lucide-factory"
              >{{ company.industry.name }}</UBadge
            >
            <CompaniesAvoidedBadge v-if="company.avoidedAt" size="lg" />
          </div>
        </header>

        <UCard>
          <dl
            class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
            data-testid="company-stats"
          >
            <div v-for="s in stats" :key="s.label">
              <dt class="text-sm text-muted">{{ s.label }}</dt>
              <dd class="text-2xl font-semibold text-highlighted">{{ s.value }}</dd>
            </div>
          </dl>
        </UCard>

        <div class="grid items-start gap-4 lg:grid-cols-3">
          <AppCard title="Positions" class="lg:col-span-2">
            <div v-if="positions.length" class="space-y-1" data-testid="company-positions">
              <DashboardRow
                v-for="p in positions"
                :id="p.id"
                :key="p.id"
                :title="p.title"
                :subtitle="p.jobRole.name"
              >
                <div class="flex flex-wrap justify-end gap-1">
                  <UBadge
                    v-if="p.archivedAt"
                    color="neutral"
                    variant="subtle"
                    icon="i-lucide-archive"
                    >Archived</UBadge
                  >
                  <ListingsStatusBadge :status="p.status" />
                </div>
              </DashboardRow>
            </div>
            <div
              v-else
              class="flex flex-col items-center justify-center gap-3 py-8 text-center"
              data-testid="company-positions-empty"
            >
              <UIcon name="i-lucide-briefcase" class="size-10 text-muted" />
              <p>No listings at this company yet.</p>
              <UButton to="/listings/add" icon="i-lucide-plus">Add listing</UButton>
            </div>
          </AppCard>

          <div class="space-y-4">
            <AppCard title="Contacts">
              <template #actions>
                <UButton
                  v-if="contacts.length"
                  icon="i-lucide-user-plus"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  data-testid="contact-add"
                  @click="openContactForm(null)"
                  >Add</UButton
                >
              </template>
              <CompaniesContactList
                v-if="contacts.length"
                :contacts="contacts"
                editable
                @edit="openContactForm"
                @delete="deletingContact = $event"
              />
              <div
                v-else
                class="flex flex-col items-center justify-center gap-3 py-6 text-center"
                data-testid="contacts-empty"
              >
                <UIcon name="i-lucide-users" class="size-10 text-muted" />
                <p>No contacts yet.</p>
                <UButton
                  color="neutral"
                  variant="subtle"
                  icon="i-lucide-user-plus"
                  data-testid="contact-add"
                  @click="openContactForm(null)"
                  >Add contact</UButton
                >
              </div>
            </AppCard>

            <AppCard title="Locations">
              <ul v-if="locations.length" class="space-y-2" data-testid="company-locations">
                <li
                  v-for="l in locations"
                  :key="l.id"
                  class="flex items-center gap-2"
                  data-testid="company-location"
                >
                  <UIcon name="i-lucide-map-pin" class="size-4 shrink-0 text-muted" />
                  <span class="min-w-0 flex-1 truncate">{{ l.label }}</span>
                  <UBadge
                    v-if="l.isTarget"
                    color="primary"
                    variant="subtle"
                    size="sm"
                    class="shrink-0"
                    data-testid="company-location-preferred"
                    >Preferred</UBadge
                  >
                  <span class="shrink-0 text-sm text-muted">{{
                    l.listingCount === 1 ? '1 listing' : `${l.listingCount} listings`
                  }}</span>
                </li>
              </ul>
              <div
                v-else
                class="flex flex-col items-center justify-center gap-3 py-6 text-center"
                data-testid="company-locations-empty"
              >
                <UIcon name="i-lucide-map-pin-off" class="size-10 text-muted" />
                <p>No locations yet.</p>
                <UButton
                  :to="`/companies/${company.id}/edit`"
                  color="neutral"
                  variant="subtle"
                  icon="i-lucide-pencil"
                  >Edit company</UButton
                >
              </div>
            </AppCard>

            <UCard>
              <template #header>
                <div class="flex items-center justify-between gap-2">
                  <h2 class="font-semibold">Notes</h2>
                  <UButton
                    v-if="company.notes"
                    icon="i-lucide-pencil"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    aria-label="Edit notes"
                    data-testid="company-notes-edit"
                    @click="notesOpen = true"
                  />
                </div>
              </template>

              <LazyAppMarkdownContent
                v-if="company.notes"
                :source="company.notes"
                data-testid="company-notes"
              />
              <div
                v-else
                class="flex flex-col items-center justify-center gap-3 py-6 text-center"
                data-testid="company-notes-empty"
              >
                <UIcon name="i-lucide-notebook-pen" class="size-10 text-muted" />
                <p>No notes yet.</p>
                <UButton
                  color="neutral"
                  variant="subtle"
                  icon="i-lucide-plus"
                  data-testid="company-notes-add"
                  @click="notesOpen = true"
                  >Add notes</UButton
                >
              </div>
            </UCard>
          </div>
        </div>

        <CompaniesNotesModal
          v-model:open="notesOpen"
          :company-id="company.id"
          :notes="company.notes"
          @saved="refresh"
        />

        <CompaniesContactModal
          v-model:open="contactFormOpen"
          :company-id="company.id"
          :contact="editingContact"
          @changed="refresh"
        />

        <AppConfirmModal
          v-model:open="deleteContactOpen"
          title="Delete this contact?"
          :description="
            deletingContact
              ? `${deletingContact.name}. Listings linked to them are kept.`
              : undefined
          "
          confirm-label="Delete"
          :loading="deletingContactLoading"
          @confirm="deleteContact"
        />

        <AppConfirmModal
          v-model:open="avoidOpen"
          title="Avoid this company?"
          description="Its listings stay visible with an Avoided company badge. Note the reason in Notes."
          confirm-label="Avoid"
          :loading="avoiding"
          @confirm="setAvoided(true)"
        />
      </template>
    </div>
  </div>
</template>

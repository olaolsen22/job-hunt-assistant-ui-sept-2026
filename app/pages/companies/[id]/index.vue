<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ResultOf } from 'gql.tada'
import { DELETE_CONTACT, type CompanyContact } from '~/composables/contactFields'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { companyKindLabel, companySizeRange } from '~/constants/company'
import { LANGUAGE_OPTIONS, WORK_MODE_OPTIONS } from '~/constants/listing'

definePageMeta({ title: 'Company' })

const route = useRoute()
const id = Number(route.params.id)
const companiesView = useCompaniesView()
useBackLink({ to: companiesView, label: 'Companies' })

// There is no single-company query, so the list is filtered to one id. Both listing fields are in
// the same request to avoid a waterfall; archived ones need their own field (`archived: true`).
// `take: 50` is a literal like the other lists (the cost check rejects a variable), and far more
// than one company ever gets.
// Open and archived listings come from two fields, so both read the same selection.
const COMPANY_POSITION = graphql(`
  fragment CompanyPosition on Listing {
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
`)

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
          orgNumber
          websiteUrl
          careersUrl
          linkedInUrl
          kind
          sizeBand
          foundedYear
          description
          workMode
          workingLanguage
          researchedAt
          skills {
            skill {
              id
              name
            }
          }
        }
      }
      open: listings(take: 50, where: { companyId: { eq: $id } }) {
        items {
          ...CompanyPosition
        }
      }
      archived: listings(take: 50, archived: true, where: { companyId: { eq: $id } }) {
        items {
          ...CompanyPosition
        }
      }
    }
  `,
  [CONTACT_FIELDS, COMPANY_POSITION]
)

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

type Position = ResultOf<typeof COMPANY_POSITION>
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

// Every fact is listed, unset ones as "Not set", so a half-researched company shows what's missing.
const facts = computed(() => {
  const c = company.value
  if (!c) return []
  const size = companySizeRange(c.sizeBand)
  return [
    { label: 'Type', value: companyKindLabel(c.kind) },
    { label: 'Size', value: size && `${size} employees` },
    { label: 'Founded', value: c.foundedYear?.toString() },
    { label: 'Work mode', value: WORK_MODE_OPTIONS.find((o) => o.value === c.workMode)?.label },
    {
      label: 'Working language',
      value: LANGUAGE_OPTIONS.find((o) => o.value === c.workingLanguage)?.label
    },
    { label: 'Org.nr', value: c.orgNumber && formatOrgNumber(c.orgNumber) }
  ]
})

const links = computed(() =>
  [
    { label: 'Website', to: company.value?.websiteUrl },
    { label: 'Careers page', to: company.value?.careersUrl },
    { label: 'LinkedIn', to: company.value?.linkedInUrl }
  ].filter((l): l is { label: string; to: string } => !!l.to)
)

const hasResearch = computed(() => !!company.value && hasCompanyResearch(company.value))

const { success: toastSuccess } = useAppToast()
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
  toastSuccess(isAvoided ? 'Company avoided' : 'No longer avoided')
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
      <div v-if="company" class="flex sm:justify-end">
        <!-- Research beside Edit, like Analyze ad on a listing. -->
        <div class="flex w-full items-center gap-2 sm:w-auto">
          <UButton
            :to="`/companies/${company.id}/edit?analyze`"
            icon="i-lucide-sparkles"
            color="neutral"
            variant="subtle"
            class="min-w-0 flex-1 justify-center sm:w-auto sm:flex-none"
            data-testid="company-research-ai"
            >{{ hasResearch ? 'Re-research' : 'Research company' }}</UButton
          >
          <UButton
            :to="`/companies/${company.id}/edit`"
            icon="i-lucide-pencil"
            class="min-w-0 flex-1 justify-center sm:w-auto sm:flex-none"
            >Edit</UButton
          >
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
            <AppFavoriteButton
              :id="company.id"
              target="company"
              :favorited-at="company.favoritedAt"
              size="md"
              class="shrink-0"
            />
          </div>

          <div
            v-if="company.industry || company.kind || company.sizeBand || company.avoidedAt"
            class="flex flex-wrap gap-2"
          >
            <UBadge
              v-if="company.industry"
              color="neutral"
              variant="subtle"
              size="lg"
              icon="i-lucide-factory"
              >{{ company.industry.name }}</UBadge
            >
            <UBadge v-if="company.kind" color="neutral" variant="outline" size="lg">{{
              companyKindLabel(company.kind)
            }}</UBadge>
            <UBadge
              v-if="company.sizeBand"
              color="neutral"
              variant="outline"
              size="lg"
              icon="i-lucide-users"
              >{{ companySizeRange(company.sizeBand) }} employees</UBadge
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

        <AppCard title="Research" data-testid="company-research">
          <template v-if="hasResearch" #actions>
            <UButton
              :to="`/companies/${company.id}/edit`"
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Edit research"
            />
          </template>
          <div v-if="hasResearch" class="space-y-4">
            <p v-if="company.description" class="max-w-prose break-words">
              {{ company.description }}
            </p>
            <div v-if="links.length" class="flex flex-wrap gap-2">
              <UButton
                v-for="l in links"
                :key="l.label"
                :to="l.to"
                target="_blank"
                rel="noopener"
                color="neutral"
                variant="soft"
                trailing-icon="i-lucide-external-link"
                >{{ l.label }}</UButton
              >
            </div>
            <dl class="grid gap-x-6 gap-y-2 sm:grid-cols-2" data-testid="company-facts">
              <div v-for="f in facts" :key="f.label" class="flex justify-between gap-4">
                <dt class="text-muted">{{ f.label }}</dt>
                <dd :class="f.value ? 'text-highlighted' : 'text-dimmed'">
                  {{ f.value || 'Not set' }}
                </dd>
              </div>
            </dl>
            <div
              v-if="company.skills.length"
              class="flex flex-wrap gap-1.5"
              data-testid="company-skills"
            >
              <UBadge
                v-for="{ skill } in company.skills"
                :key="skill.id"
                color="neutral"
                variant="subtle"
                >{{ skill.name }}</UBadge
              >
            </div>
            <p v-if="company.researchedAt" class="text-sm text-muted">
              Researched
              {{ formatDate(new Date(company.researchedAt).toLocaleDateString('sv-SE')) }}
            </p>
          </div>
          <div
            v-else
            class="flex flex-col items-center justify-center gap-3 py-6 text-center"
            data-testid="company-research-empty"
          >
            <UIcon name="i-lucide-search" class="size-10 text-muted" />
            <p>No research yet.</p>
            <p class="text-sm text-muted">Add details to compare this company with others.</p>
            <div class="flex flex-col gap-2 sm:flex-row">
              <UButton
                :to="`/companies/${company.id}/edit?analyze`"
                icon="i-lucide-sparkles"
                data-testid="company-research-empty-ai"
                >Research company</UButton
              >
              <UButton
                :to="`/companies/${company.id}/edit`"
                color="neutral"
                variant="subtle"
                icon="i-lucide-plus"
                >Add research</UButton
              >
            </div>
          </div>
        </AppCard>

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
              ? `${deletingContact.name} and their logged interactions. Listings linked to them are kept.`
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

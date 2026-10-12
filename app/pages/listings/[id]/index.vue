<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import {
  EMPLOYMENT_TYPE_OPTIONS,
  LANGUAGE_OPTIONS,
  SCHEDULE_OPTIONS,
  SENIORITY_OPTIONS,
  WORK_MODE_OPTIONS
} from '~/constants/listing'

definePageMeta({ title: 'Listing' })

const route = useRoute()
const id = Number(route.params.id)

const { listing, loading, error, refresh } = await useListing(id)
const listingsView = useListingsView()

const UPDATE_LISTING = graphql(`
  mutation UpdateListing($id: Int!, $listing: ListingInput!) {
    updateListing(input: { id: $id, listing: $listing }) {
      listing {
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

const SET_ARCHIVED = graphql(`
  mutation SetListingArchived($input: SetListingArchivedInput!) {
    setListingArchived(input: $input) {
      listing {
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

const toast = useToast()
const { state, toInput, fill } = useListingForm()
const markOpen = ref(false)
const marking = ref(false)

// The API has no mutation for just this flag and updateListing replaces the whole listing,
// so rebuild the full input from the loaded listing.
const markAnalyzed = async () => {
  if (!listing.value) return
  marking.value = true
  try {
    fill(listing.value)
    state.isAnalyzed = true
    const { updateListing } = await gql(UPDATE_LISTING, {
      id,
      listing: toInput()
    })
    if (updateListing.errors?.length) {
      toast.add({ title: updateListing.errors[0]!.message, color: 'error' })
      return
    }
    await refresh()
    toast.add({ title: 'Marked as analyzed', color: 'success', icon: 'i-lucide-check' })
  } catch {
    toast.add({ title: ERROR_MESSAGES.generic, color: 'error' })
  } finally {
    marking.value = false
    markOpen.value = false
  }
}

const { run: runArchive, loading: archiving } = useMutation(refresh)

// Applied listings can't be deleted; archiving is how finished ones leave the list.
const toggleArchived = async () => {
  if (!listing.value) return
  const isArchived = !listing.value.archivedAt
  const ok = await runArchive(async () => {
    const { setListingArchived } = await gql(SET_ARCHIVED, { input: { id, isArchived } })
    return setListingArchived.errors
  })
  if (!ok) return
  await refresh()
  toast.add({ title: isArchived ? 'Archived' : 'Unarchived', color: 'success' })
}

// Infrequent actions live in the menu so Edit is the one obvious primary button.
const moreItems = computed<DropdownMenuItem[]>(() => {
  const l = listing.value
  if (!l) return []
  return [
    ...(l.analyzedAt
      ? []
      : [
          {
            label: 'Mark analyzed',
            icon: 'i-lucide-check-check',
            onSelect: () => (markOpen.value = true)
          }
        ]),
    l.archivedAt
      ? { label: 'Unarchive', icon: 'i-lucide-archive-restore', onSelect: toggleArchived }
      : { label: 'Archive', icon: 'i-lucide-archive', onSelect: toggleArchived }
  ]
})

const NOT_STATED = 'Not stated'
const labelOf = <T extends string>(
  options: readonly { label: string; value: T }[],
  value: T | null
) => options.find((o) => o.value === value)?.label ?? NOT_STATED

const skillsByRequirement = computed(() => {
  const skills = listing.value?.skills ?? []
  return [
    { title: 'Required', skills: skills.filter((s) => s.isRequired) },
    { title: 'Nice to have', skills: skills.filter((s) => !s.isRequired) }
  ].filter((group) => group.skills.length)
})
</script>

<template>
  <div class="flex justify-center">
    <div class="w-full max-w-3xl space-y-4 sm:space-y-6 lg:max-w-6xl">
      <!-- Stacked below sm so Back never shares a line with the actions on a phone. -->
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <UButton
          :to="listingsView"
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          class="self-start"
        >
          Back
        </UButton>

        <div v-if="listing" class="flex items-center gap-2">
          <UButton
            :to="`/listings/${listing.id}/edit?analyze`"
            icon="i-lucide-sparkles"
            color="neutral"
            variant="subtle"
            data-testid="listing-analyze"
            >{{ listing.analyzedAt ? 'Re-analyze ad' : 'Analyze ad' }}</UButton
          >
          <UButton :to="`/listings/${listing.id}/edit`" icon="i-lucide-pencil">Edit</UButton>
          <UDropdownMenu :items="moreItems" :content="{ align: 'end' }">
            <UButton
              icon="i-lucide-ellipsis-vertical"
              color="neutral"
              variant="subtle"
              aria-label="More actions"
              :loading="archiving"
              data-testid="listing-more"
            />
          </UDropdownMenu>
        </div>
      </div>

      <UAlert v-if="error" color="error" :description="ERROR_MESSAGES.generic" />

      <UAlert
        v-else-if="!loading && !listing"
        color="error"
        title="Listing not found"
        description="It may have been deleted."
      />

      <!-- Only on first load: refreshes after an action keep the page (and its open modals) mounted. -->
      <div v-else-if="loading && !listing" class="space-y-4" data-testid="listing-loading">
        <USkeleton class="h-32 w-full" />
        <USkeleton class="h-40 w-full" />
        <div class="grid gap-4 lg:grid-cols-3">
          <USkeleton class="h-96 w-full lg:col-span-2" />
          <USkeleton class="h-40 w-full" />
        </div>
      </div>

      <template v-else-if="listing">
        <UAlert
          v-if="listing.archivedAt"
          color="neutral"
          variant="subtle"
          icon="i-lucide-archive"
          title="This listing is archived"
          description="It is hidden from the default list."
          :actions="[
            {
              label: 'Unarchive',
              color: 'neutral',
              variant: 'outline',
              loading: archiving,
              onClick: toggleArchived
            }
          ]"
          data-testid="listing-archived-notice"
        />

        <header class="space-y-3" data-testid="listing-header">
          <div class="flex items-start justify-between gap-2">
            <h1 class="min-w-0 break-words text-xl font-semibold text-highlighted">
              {{ listing.title }}
            </h1>
            <ListingsFavoriteButton
              :id="listing.id"
              :favorited-at="listing.favoritedAt"
              size="md"
              class="shrink-0"
            />
          </div>

          <div class="flex flex-wrap gap-2">
            <ListingsStatusBadge :status="listing.status" prominent />
            <ListingsAnalyzedBadge :analyzed-at="listing.analyzedAt" size="lg" />
            <UBadge
              v-if="listing.archivedAt"
              color="neutral"
              variant="subtle"
              size="lg"
              icon="i-lucide-archive"
              data-testid="listing-archived"
              >Archived</UBadge
            >
            <CompaniesAvoidedBadge
              v-if="listing.company.avoidedAt"
              label="Avoided company"
              size="lg"
            />
          </div>

          <div class="space-y-2 sm:grid sm:grid-cols-2 sm:gap-x-4 sm:space-y-0">
            <div class="space-y-2">
              <p class="flex items-center gap-1.5 text-sm text-muted">
                <UIcon name="i-lucide-building-2" class="size-4 shrink-0" />
                <ULink :to="`/companies/${listing.company.id}`" data-testid="listing-company">{{
                  listing.company.name
                }}</ULink>
              </p>
              <p
                class="flex items-center gap-1.5 text-sm text-muted"
                data-testid="listing-job-role"
              >
                <UIcon name="i-lucide-briefcase" class="size-4 shrink-0" />
                {{ listing.jobRole.name }}
              </p>
              <ListingsLocation :listing="listing" />
            </div>
            <div class="mt-2 sm:mt-0">
              <ListingsDates :listing="listing" />
            </div>
          </div>

          <UButton
            :to="listing.url"
            target="_blank"
            rel="noopener"
            variant="soft"
            color="neutral"
            icon="i-lucide-external-link"
            label="View ad"
            data-testid="listing-view-ad"
          />
        </header>

        <ListingsApplication :listing="listing" @changed="refresh" />
        <ListingsTailoredCvCard :listing-id="listing.id" />

        <div
          class="space-y-4 sm:space-y-6 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6 lg:space-y-0"
        >
          <div class="space-y-4 sm:space-y-6 lg:col-span-2">
            <AppCard title="Details">
              <dl class="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt class="text-xs text-muted">Work mode</dt>
                  <dd class="text-sm" :class="{ 'text-muted': !listing.workMode }">
                    {{ labelOf(WORK_MODE_OPTIONS, listing.workMode) }}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-muted">Employment type</dt>
                  <dd class="text-sm" :class="{ 'text-muted': !listing.employmentType }">
                    {{ labelOf(EMPLOYMENT_TYPE_OPTIONS, listing.employmentType) }}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-muted">Schedule</dt>
                  <dd class="text-sm" :class="{ 'text-muted': !listing.schedule }">
                    {{ labelOf(SCHEDULE_OPTIONS, listing.schedule) }}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-muted">Seniority</dt>
                  <dd class="text-sm" :class="{ 'text-muted': !listing.seniority }">
                    {{ labelOf(SENIORITY_OPTIONS, listing.seniority) }}
                  </dd>
                </div>

                <div>
                  <dt class="text-xs text-muted">Language requirements</dt>
                  <dd v-if="!listing.languages.length" class="text-sm text-muted">None required</dd>
                  <dd v-else class="flex flex-wrap gap-2 pt-0.5">
                    <UBadge
                      v-for="(lang, i) in listing.languages"
                      :key="i"
                      color="neutral"
                      variant="subtle"
                    >
                      {{ labelOf(LANGUAGE_OPTIONS, lang.language)
                      }}{{ lang.level ? ` · ${lang.level}` : ''
                      }}{{ lang.isRequired ? ' · required' : ' · optional' }}
                    </UBadge>
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-muted">Ad language</dt>
                  <dd class="text-sm" :class="{ 'text-muted': !listing.postingLanguage }">
                    {{ labelOf(LANGUAGE_OPTIONS, listing.postingLanguage) }}
                  </dd>
                </div>
              </dl>
            </AppCard>

            <AppCard title="Summary">
              <p v-if="listing.description" class="whitespace-pre-line text-sm">
                {{ listing.description }}
              </p>
              <p v-else class="text-sm text-muted">No summary</p>
            </AppCard>
          </div>

          <div class="space-y-4 sm:space-y-6">
            <AppCard title="Skills">
              <p v-if="!listing.skills.length" class="text-sm text-muted">No skills listed</p>
              <div v-else class="space-y-4">
                <div v-for="group in skillsByRequirement" :key="group.title" class="space-y-1">
                  <p class="text-xs font-medium uppercase text-muted">{{ group.title }}</p>
                  <div class="divide-y divide-default">
                    <div
                      v-for="(skill, i) in group.skills"
                      :key="i"
                      class="flex items-center justify-between gap-2 py-2"
                    >
                      <span class="min-w-0 truncate font-medium">{{ skill.skill.name }}</span>
                      <span class="shrink-0 text-sm text-muted">
                        Level {{ skill.level }}/5<template v-if="skill.minYears">
                          · {{ skill.minYears }}+ yrs</template
                        >
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </AppCard>

            <AppCard v-if="listing.contacts.length" title="Contacts">
              <template #actions>
                <UButton
                  :to="`/companies/${listing.company.id}`"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  trailing-icon="i-lucide-arrow-right"
                  >Manage</UButton
                >
              </template>
              <CompaniesContactList :contacts="listing.contacts.map(({ contact }) => contact)" />
            </AppCard>
          </div>
        </div>

        <AppConfirmModal
          v-model:open="markOpen"
          title="Mark as analyzed?"
          :description="`${listing.title} at ${listing.company.name}`"
          confirm-label="Mark analyzed"
          :loading="marking"
          @confirm="markAnalyzed"
        />
      </template>
    </div>
  </div>
</template>

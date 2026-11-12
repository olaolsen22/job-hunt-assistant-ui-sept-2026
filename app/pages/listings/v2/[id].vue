<script setup lang="ts">
import { useMediaQuery, useResizeObserver } from '@vueuse/core'

// Read-only v2 of the listing page, designed from the listing data alone; v1 stays at
// /listings/[id] and nothing links here yet.
definePageMeta({ title: 'Listing' })

const route = useRoute()
const id = Number(route.params.id)

// Both requests start before either is awaited, so the map never waits on the listing.
const overview = useListingOverview(id)
const map = useRequirementMapQuery(id)
const { listing, loading, error, refresh } = await overview

const listingsView = useListingsView()

// The page renders client-side only (server: false data), so this is known before content shows.
const isPhone = useMediaQuery('(max-width: 39.99rem)')

const descriptionEl = ref<HTMLElement>()
const descriptionOpen = ref(false)
const descriptionClamped = ref(false)
// The toggle only shows when the clamp actually hides text; re-measured when the width changes
// (sidebar collapse, rotation). While expanded nothing is clamped, so the last answer stands.
useResizeObserver(descriptionEl, ([entry]) => {
  if (descriptionOpen.value || !entry) return
  const el = entry.target as HTMLElement
  descriptionClamped.value = el.scrollHeight > el.clientHeight
})
watch(
  descriptionEl,
  async (el) => {
    if (!el) return
    await nextTick()
    descriptionClamped.value = el.scrollHeight > el.clientHeight
  },
  { flush: 'post' }
)

const DESCRIPTION_LANG = { ENGLISH: 'en', NORWEGIAN: 'nb' } as const

const progressCount = computed(() =>
  listing.value
    ? listing.value.statusHistory.length +
      listing.value.interviews.length +
      listing.value.applicationQuestions.length
    : 0
)
</script>

<template>
  <div class="space-y-4 @container sm:space-y-6">
    <template v-if="error">
      <ULink :to="listingsView" class="inline-flex items-center gap-1.5 py-2 text-sm text-muted">
        <UIcon name="i-lucide-arrow-left" class="size-4 shrink-0" />
        Back to listings
      </ULink>
      <UAlert
        color="error"
        title="Couldn't load the listing"
        :description="error.message"
        :actions="[
          { label: 'Try again', color: 'neutral', variant: 'outline', onClick: () => refresh() }
        ]"
        data-testid="overview-error"
      />
    </template>

    <div v-else-if="loading && !listing" class="space-y-4" data-testid="overview-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-16 w-full" />
      <div class="grid gap-4 @5xl:grid-cols-3">
        <USkeleton class="h-96 w-full @5xl:col-span-2" />
        <USkeleton class="h-64 w-full" />
      </div>
    </div>

    <template v-else-if="!listing">
      <ULink :to="listingsView" class="inline-flex items-center gap-1.5 py-2 text-sm text-muted">
        <UIcon name="i-lucide-arrow-left" class="size-4 shrink-0" />
        Back to listings
      </ULink>
      <UAlert
        color="error"
        title="Listing not found"
        description="It may have been deleted."
        data-testid="overview-not-found"
      />
    </template>

    <template v-else>
      <ListingOverviewHeader :listing="listing" />

      <UAlert
        v-if="listing.archivedAt"
        color="neutral"
        variant="subtle"
        icon="i-lucide-archive"
        title="This listing is archived"
        data-testid="overview-archived"
      />

      <ListingOverviewFacts :listing="listing" />
      <ListingOverviewTraining v-if="listing.trainingProgram" :program="listing.trainingProgram" />

      <!-- DOM order = reading and tab order at every width: requirements, description, progress,
           then the side sections. Two columns from @5xl, three from @7xl (container widths, so a
           collapsed sidebar switches earlier). -->
      <div class="grid items-start gap-4 sm:gap-6 @5xl:grid-cols-3 @7xl:grid-cols-12">
        <div
          class="grid items-start gap-4 sm:gap-6 @5xl:col-span-2 @7xl:col-span-9 @7xl:grid-cols-9"
        >
          <div class="@7xl:col-span-4">
            <ListingOverviewRequirements
              :listing="listing"
              :map="map.data.value"
              :pending="map.status.value === 'pending'"
              :failed="!!map.error.value"
            />
          </div>

          <div class="space-y-4 sm:space-y-6 @7xl:col-span-5">
            <AppCard title="About the role" data-testid="overview-description">
              <template v-if="listing.description">
                <p
                  ref="descriptionEl"
                  :lang="
                    listing.postingLanguage ? DESCRIPTION_LANG[listing.postingLanguage] : undefined
                  "
                  class="max-w-prose text-sm wrap-break-word whitespace-pre-line"
                  :class="{ 'line-clamp-12': !descriptionOpen }"
                >
                  {{ listing.description }}
                </p>
                <UButton
                  v-if="descriptionClamped"
                  variant="link"
                  class="mt-2 px-0"
                  :aria-expanded="descriptionOpen"
                  data-testid="overview-description-toggle"
                  @click="descriptionOpen = !descriptionOpen"
                  >{{ descriptionOpen ? 'Show less' : 'Show full description' }}</UButton
                >
              </template>
              <p v-else class="text-sm text-muted" data-testid="overview-no-description">
                No description saved.
                <ULink v-if="listing.url" :to="listing.url" target="_blank" class="text-primary"
                  >View the original posting</ULink
                >
              </p>
            </AppCard>

            <ListingOverviewSection
              title="Application progress"
              :count="progressCount"
              :collapsible="isPhone"
              data-testid="overview-progress"
            >
              <ListingOverviewProgress :listing="listing" />
            </ListingOverviewSection>
          </div>
        </div>

        <div class="space-y-4 sm:space-y-6 @7xl:col-span-3">
          <ListingOverviewSection title="Company" :collapsible="isPhone">
            <ListingOverviewCompany :company="listing.company" />
          </ListingOverviewSection>
          <ListingOverviewSection
            v-if="listing.contacts.length"
            title="Contacts"
            :count="listing.contacts.length"
            :collapsible="isPhone"
            data-testid="overview-contacts"
          >
            <CompaniesContactList :contacts="listing.contacts.map(({ contact }) => contact)" />
          </ListingOverviewSection>
          <ListingOverviewSection
            v-if="listing.documents.length"
            title="Documents"
            :count="listing.documents.length"
            :collapsible="isPhone"
            data-testid="overview-documents"
          >
            <ListingOverviewDocuments :documents="listing.documents" />
          </ListingOverviewSection>
        </div>
      </div>

      <ListingOverviewRecordDates :listing="listing" />
    </template>
  </div>
</template>

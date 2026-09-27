<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import {
  EMPLOYMENT_TYPE_OPTIONS,
  LANGUAGE_OPTIONS,
  SCHEDULE_OPTIONS,
  SENIORITY_OPTIONS,
  WORK_MODE_OPTIONS,
  type CefrLevel,
  type DeadlineType,
  type EmploymentType,
  type Language,
  type Schedule,
  type Seniority,
  type WorkMode
} from '~/constants/listing'

definePageMeta({ title: 'Listing' })

interface ListingDetail {
  id: number
  title: string
  company: { name: string }
  jobRole: { name: string }
  seniority: Seniority | null
  employmentType: EmploymentType | null
  schedule: Schedule | null
  workMode: WorkMode | null
  description: string | null
  url: string
  postedOn: string
  deadlineType: DeadlineType
  deadlineOn: string | null
  postingLanguage: Language | null
  favoritedAt: string | null
  locations: { location: { city: string | null; countryCode: string } }[]
  languages: { language: Language; level: CefrLevel | null; isRequired: boolean }[]
  skills: { skill: { name: string }; level: number; minYears: number | null; isRequired: boolean }[]
}

const LISTING_QUERY = `
  query ListingById($id: Int!) {
    listingById(id: $id) {
      id
      title
      company { name }
      jobRole { name }
      seniority
      employmentType
      schedule
      workMode
      description
      url
      postedOn
      deadlineType
      deadlineOn
      postingLanguage
      favoritedAt
      locations { location { city countryCode } }
      languages { language level isRequired }
      skills { skill { name } level minYears isRequired }
    }
  }
`

const route = useRoute()
const id = Number(route.params.id)

const { data, status, error } = await useAsyncData(
  `listing-${id}`,
  () => gql<{ listingById: ListingDetail | null }>(LISTING_QUERY, { id }),
  { server: false }
)

const listing = computed(() => data.value?.listingById ?? null)
const loading = computed(() => status.value === 'pending')

const labelOf = <T extends string>(
  options: readonly { label: string; value: T }[],
  value: T | null
) => options.find((o) => o.value === value)?.label ?? 'Not stated'
</script>

<template>
  <div class="flex justify-center">
    <div class="w-full max-w-3xl space-y-4 sm:space-y-6">
      <div class="flex items-center justify-between gap-4">
        <UButton to="/listings" icon="i-lucide-arrow-left" variant="ghost" color="neutral">
          Back
        </UButton>

        <div v-if="listing" class="flex items-center gap-2">
          <ListingsFavoriteButton :id="listing.id" :favorited-at="listing.favoritedAt" />
          <UButton icon="i-lucide-pencil">Edit</UButton>
        </div>
      </div>

      <UAlert v-if="error" color="error" :description="ERROR_MESSAGES.generic" />

      <UAlert
        v-else-if="!loading && !listing"
        color="error"
        title="Listing not found"
        description="It may have been deleted."
      />

      <div v-else-if="loading" class="space-y-4" data-testid="listing-loading">
        <USkeleton class="h-96 w-full" />
        <USkeleton class="h-40 w-full" />
        <USkeleton class="h-32 w-full" />
      </div>

      <template v-else-if="listing">
        <AppCard title="Job">
          <div class="space-y-3">
            <div class="space-y-1">
              <h1 class="text-lg font-semibold text-highlighted">{{ listing.title }}</h1>
              <p class="flex items-center gap-1.5 text-sm text-muted">
                <UIcon name="i-lucide-building-2" class="size-4 shrink-0" />
                {{ listing.company.name }}
              </p>
              <p class="text-sm text-muted">{{ listing.jobRole.name }}</p>
              <ListingsLocation :listing="listing" />
            </div>

            <UButton
              :to="listing.url"
              target="_blank"
              rel="noopener"
              variant="soft"
              icon="i-lucide-external-link"
            >
              View posting
            </UButton>

            <div class="grid gap-3 sm:grid-cols-2 sm:gap-4">
              <div>
                <p class="text-xs text-muted">Work mode</p>
                <p>{{ labelOf(WORK_MODE_OPTIONS, listing.workMode) }}</p>
              </div>
              <div>
                <p class="text-xs text-muted">Employment type</p>
                <p>{{ labelOf(EMPLOYMENT_TYPE_OPTIONS, listing.employmentType) }}</p>
              </div>
              <div>
                <p class="text-xs text-muted">Schedule</p>
                <p>{{ labelOf(SCHEDULE_OPTIONS, listing.schedule) }}</p>
              </div>
              <div>
                <p class="text-xs text-muted">Seniority</p>
                <p>{{ labelOf(SENIORITY_OPTIONS, listing.seniority) }}</p>
              </div>

              <div class="sm:col-span-2">
                <p class="text-xs text-muted">Language requirements</p>
                <p v-if="!listing.languages.length" class="text-sm text-muted">None required.</p>
                <div v-else class="flex flex-wrap gap-2">
                  <UBadge
                    v-for="(lang, i) in listing.languages"
                    :key="i"
                    :color="lang.isRequired ? 'primary' : 'neutral'"
                    :variant="lang.isRequired ? 'solid' : 'subtle'"
                  >
                    {{ labelOf(LANGUAGE_OPTIONS, lang.language)
                    }}{{ lang.level ? ` · ${lang.level}` : '' }}
                  </UBadge>
                </div>
              </div>
              <div>
                <p class="text-xs text-muted">Ad language</p>
                <p>{{ labelOf(LANGUAGE_OPTIONS, listing.postingLanguage) }}</p>
              </div>
            </div>

            <ListingsDates :listing="listing" />
          </div>
        </AppCard>

        <AppCard title="Skills">
          <p v-if="!listing.skills.length" class="text-sm text-muted">No skills listed</p>
          <div v-else class="divide-y divide-default">
            <div
              v-for="(skill, i) in listing.skills"
              :key="i"
              class="flex items-center justify-between gap-2 py-2"
            >
              <span class="font-medium">{{ skill.skill.name }}</span>
              <div class="flex items-center gap-2">
                <span class="text-sm text-muted">
                  Level {{ skill.level }}/5<template v-if="skill.minYears">
                    · {{ skill.minYears }}+ yrs</template
                  >
                </span>
                <UBadge
                  :color="skill.isRequired ? 'primary' : 'neutral'"
                  :variant="skill.isRequired ? 'solid' : 'subtle'"
                >
                  {{ skill.isRequired ? 'Required' : 'Optional' }}
                </UBadge>
              </div>
            </div>
          </div>
        </AppCard>

        <AppCard title="Summary">
          <p v-if="listing.description" class="whitespace-pre-line text-sm">
            {{ listing.description }}
          </p>
          <p v-else class="text-sm text-muted">No summary</p>
        </AppCard>
      </template>
    </div>
  </div>
</template>

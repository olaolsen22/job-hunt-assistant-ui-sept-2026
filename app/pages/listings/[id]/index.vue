<script setup lang="ts">
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

const { listing, loading, error } = await useListing(id)

const labelOf = <T extends string>(
  options: readonly { label: string; value: T }[],
  value: T | null
) => options.find((o) => o.value === value)?.label ?? 'Not stated'
</script>

<template>
  <div class="flex justify-center">
    <div class="w-full max-w-3xl space-y-4 sm:space-y-6 lg:max-w-6xl">
      <div class="flex items-center justify-between gap-4">
        <UButton to="/listings" icon="i-lucide-arrow-left" variant="ghost" color="neutral">
          Back
        </UButton>

        <div v-if="listing" class="flex items-center gap-2">
          <ListingsFavoriteButton :id="listing.id" :favorited-at="listing.favoritedAt" />
          <UButton :to="`/listings/${listing.id}/edit`" icon="i-lucide-pencil">Edit</UButton>
        </div>
      </div>

      <UAlert v-if="error" color="error" :description="ERROR_MESSAGES.generic" />

      <UAlert
        v-else-if="!loading && !listing"
        color="error"
        title="Listing not found"
        description="It may have been deleted."
      />

      <div v-else-if="loading" class="grid gap-4 lg:grid-cols-3" data-testid="listing-loading">
        <USkeleton class="h-96 w-full lg:col-span-2" />
        <USkeleton class="h-40 w-full" />
        <USkeleton class="h-32 w-full lg:col-span-3" />
      </div>

      <template v-else-if="listing">
        <div
          class="space-y-4 sm:space-y-6 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6 lg:space-y-0"
        >
          <AppCard title="Job" class="lg:col-span-2">
            <div class="space-y-4">
              <h1 class="text-lg font-semibold text-highlighted">{{ listing.title }}</h1>

              <div class="grid gap-3 sm:grid-cols-2 sm:gap-4">
                <div class="space-y-1">
                  <p class="text-sm font-medium text-highlighted">Company</p>
                  <p class="text-sm text-muted">{{ listing.company.name }}</p>
                </div>
                <div class="space-y-1">
                  <p class="text-sm font-medium text-highlighted">Role</p>
                  <p class="text-sm text-muted">{{ listing.jobRole.name }}</p>
                </div>

                <div class="space-y-1 sm:col-span-2">
                  <p class="text-sm font-medium text-highlighted">Job ad URL</p>
                  <UButton
                    :to="listing.url"
                    target="_blank"
                    rel="noopener"
                    variant="link"
                    size="sm"
                    trailing-icon="i-lucide-external-link"
                    class="max-w-full p-0"
                  >
                    <span class="truncate">{{ listing.url }}</span>
                  </UButton>
                </div>

                <div class="space-y-1 sm:col-span-2">
                  <p class="text-sm font-medium text-highlighted">Locations</p>
                  <ListingsLocation :listing="listing" />
                </div>

                <div class="space-y-1">
                  <p class="text-sm font-medium text-highlighted">Work mode</p>
                  <p class="text-sm text-muted">
                    {{ labelOf(WORK_MODE_OPTIONS, listing.workMode) }}
                  </p>
                </div>
                <div class="space-y-1">
                  <p class="text-sm font-medium text-highlighted">Employment type</p>
                  <p class="text-sm text-muted">
                    {{ labelOf(EMPLOYMENT_TYPE_OPTIONS, listing.employmentType) }}
                  </p>
                </div>
                <div class="space-y-1">
                  <p class="text-sm font-medium text-highlighted">Schedule</p>
                  <p class="text-sm text-muted">
                    {{ labelOf(SCHEDULE_OPTIONS, listing.schedule) }}
                  </p>
                </div>
                <div class="space-y-1">
                  <p class="text-sm font-medium text-highlighted">Seniority</p>
                  <p class="text-sm text-muted">
                    {{ labelOf(SENIORITY_OPTIONS, listing.seniority) }}
                  </p>
                </div>

                <div class="space-y-1 sm:col-span-2">
                  <p class="text-sm font-medium text-highlighted">Language requirements</p>
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
                <div class="space-y-1 sm:col-span-2">
                  <p class="text-sm font-medium text-highlighted">Ad language</p>
                  <p class="text-sm text-muted">
                    {{ labelOf(LANGUAGE_OPTIONS, listing.postingLanguage) }}
                  </p>
                </div>

                <ListingsDates :listing="listing" detail />
              </div>
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
        </div>

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

<script setup lang="ts">
import { DUE_WITHIN_OPTIONS, type ListingsFacets } from '~/composables/useListingsList'
import { APPLICATION_STATUS_OPTIONS, LANGUAGE_OPTIONS } from '~/constants/listing'

const facets = defineModel<ListingsFacets>('facets', { required: true })

// USelect can't hold null, so "Any" is a sentinel that maps back to null.
const DUE_ITEMS = [
  { label: 'Due: any time', value: 0 },
  ...DUE_WITHIN_OPTIONS.map((days) => ({ label: `Due within ${days} days`, value: days }))
]
</script>

<template>
  <div class="space-y-4">
    <section class="space-y-3">
      <h3 class="text-sm font-semibold text-highlighted">Status</h3>
      <USelectMenu
        v-model="facets.statuses"
        :items="[...APPLICATION_STATUS_OPTIONS]"
        value-key="value"
        multiple
        placeholder="Any status"
        :search-input="false"
        class="w-full"
        aria-label="Status"
        data-testid="listings-facet-status"
      />
      <USwitch
        v-model="facets.showRejected"
        label="Show rejected applications"
        data-testid="listings-facet-rejected"
      />
    </section>
    <section class="space-y-3">
      <h3 class="text-sm font-semibold text-highlighted">Location</h3>
      <AppFilterCombobox
        v-model="facets.locationIds"
        lookup="locations"
        placeholder="Any location"
        data-testid="listings-facet-location"
      />
    </section>
    <section class="space-y-3">
      <h3 class="text-sm font-semibold text-highlighted">Language</h3>
      <div class="grid gap-3 2xl:grid-cols-2" data-testid="listings-language-fields">
        <UFormField label="Posting language">
          <USelectMenu
            v-model="facets.postingLanguages"
            :items="[...LANGUAGE_OPTIONS]"
            value-key="value"
            multiple
            placeholder="Any"
            :search-input="false"
            class="w-full"
            data-testid="listings-facet-postingLanguage"
          />
        </UFormField>
        <UFormField label="Required language">
          <USelectMenu
            v-model="facets.languages"
            :items="[...LANGUAGE_OPTIONS]"
            value-key="value"
            multiple
            placeholder="Any"
            :search-input="false"
            class="w-full"
            data-testid="listings-facet-requiredLanguage"
          />
        </UFormField>
      </div>
    </section>
    <section class="space-y-3">
      <h3 class="text-sm font-semibold text-highlighted">Skills</h3>
      <AppFilterCombobox
        v-model="facets.skills"
        lookup="skills"
        placeholder="Any skill"
        data-testid="listings-facet-skill"
      />
    </section>
    <section class="space-y-3">
      <h3 class="text-sm font-semibold text-highlighted">Dates</h3>
      <UFormField label="Due">
        <USelect
          :model-value="facets.dueWithinDays ?? 0"
          :items="DUE_ITEMS"
          class="w-full"
          data-testid="listings-facet-due"
          @update:model-value="facets.dueWithinDays = $event || null"
        />
      </UFormField>
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Posted from">
          <UInput
            v-model="facets.postedFrom"
            type="date"
            :max="facets.postedTo || undefined"
            class="w-full"
            data-testid="listings-facet-postedFrom"
          />
        </UFormField>
        <UFormField label="Posted to">
          <UInput
            v-model="facets.postedTo"
            type="date"
            :min="facets.postedFrom || undefined"
            class="w-full"
            data-testid="listings-facet-postedTo"
          />
        </UFormField>
      </div>
    </section>
  </div>
</template>

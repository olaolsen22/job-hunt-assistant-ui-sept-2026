<script setup lang="ts">
import type { CheckedJob } from '~/utils/collectedJobs'

const { jobs } = defineProps<{ jobs: CheckedJob[] }>()

// A file can hold 500 jobs; everything is already loaded, so this only limits what's rendered.
const PAGE_SIZE = 50
const shown = ref(PAGE_SIZE)

const cards = computed(() =>
  jobs.slice(0, shown.value).map(({ job, savedListingIds, isRepeat }) => {
    // The file is an external AI's JSON: only the url is guaranteed.
    const draft = cleanListingDraft(job)
    return {
      url: job.url,
      savedListingIds,
      isRepeat,
      title: draft.title || draft.companyName || new URL(job.url).hostname,
      subtitle: [draft.title && draft.companyName, draft.jobRoleName].filter(Boolean).join(' · '),
      details: [
        ...draft.locations.map(formatLocation),
        draft.postedOn && `Posted ${formatDate(draft.postedOn)}`,
        draft.deadlineType === 'DATE' && draft.deadlineOn && `Due ${formatDate(draft.deadlineOn)}`
      ]
        .filter(Boolean)
        .join(' · ')
    }
  })
)
</script>

<template>
  <div class="space-y-3">
    <ul class="grid gap-3 md:grid-cols-2" data-testid="import-jobs">
      <UCard
        v-for="(card, index) in cards"
        :key="index"
        as="li"
        class="relative hover:bg-elevated/50"
        data-testid="import-job"
      >
        <div class="flex items-start justify-between gap-3">
          <h3 class="line-clamp-2 min-w-0 font-semibold wrap-break-word text-highlighted">
            <!-- The ::after stretches the link over the card, like ListingsRow. -->
            <NuxtLink
              v-if="card.savedListingIds.length === 1"
              :to="`/listings/${card.savedListingIds[0]}`"
              class="hover:underline after:absolute after:inset-0"
              >{{ card.title }}</NuxtLink
            >
            <template v-else>{{ card.title }}</template>
          </h3>
          <UBadge
            v-if="card.savedListingIds.length"
            label="Saved"
            icon="i-lucide-check"
            color="success"
            variant="subtle"
            class="shrink-0"
          />
          <UBadge
            v-else
            :label="card.isRepeat ? 'Repeat in file' : 'Not saved'"
            color="neutral"
            variant="subtle"
            class="shrink-0"
          />
        </div>
        <p v-if="card.subtitle" class="mt-1 text-sm wrap-break-word text-muted">
          {{ card.subtitle }}
        </p>
        <p v-if="card.details" class="mt-1 text-sm text-muted">{{ card.details }}</p>
        <div class="mt-2 flex flex-wrap items-center gap-1">
          <template v-if="card.savedListingIds.length > 1">
            <UButton
              v-for="(id, position) in card.savedListingIds"
              :key="id"
              :to="`/listings/${id}`"
              color="neutral"
              variant="subtle"
              size="sm"
              class="relative z-10"
              data-testid="import-job-listing"
              >Listing {{ position + 1 }}</UButton
            >
          </template>
          <UButton
            :to="card.url"
            target="_blank"
            rel="noopener"
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-external-link"
            :aria-label="`View ad for ${card.title}`"
            class="relative z-10 ml-auto"
            data-testid="import-job-ad"
          />
        </div>
      </UCard>
    </ul>
    <div v-if="jobs.length > shown" class="flex justify-center">
      <UButton
        color="neutral"
        variant="subtle"
        data-testid="import-jobs-more"
        @click="shown += PAGE_SIZE"
        >Show more ({{ jobs.length - shown }} left)</UButton
      >
    </div>
  </div>
</template>

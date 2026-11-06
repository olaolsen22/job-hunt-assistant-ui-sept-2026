<script setup lang="ts">
import type { PossibleDuplicate } from '~/composables/listingCompareFields'

// Listings createListing thinks may be the same job, with the owner's three ways on. Shared by
// quick add's review rows and the page of a listing added on its own.
const { testidPrefix } = defineProps<{
  matches: PossibleDuplicate[]
  disabled?: boolean
  testidPrefix: string
}>()
defineEmits<{ compare: []; keep: []; remove: [] }>()
</script>

<template>
  <UAlert
    color="warning"
    variant="subtle"
    icon="i-lucide-copy"
    title="Possible duplicate"
    :data-testid="`${testidPrefix}-duplicates`"
  >
    <template #description>
      <ul class="space-y-1">
        <li v-for="match in matches" :key="match.id" class="flex flex-wrap items-center gap-x-2">
          <!-- New tab, so following it keeps what's on this page. -->
          <NuxtLink
            :to="`/listings/${match.id}`"
            target="_blank"
            class="font-medium hover:underline"
            >{{ match.title }}</NuxtLink
          >
          <span class="text-muted">{{ match.company.name }} · {{ match.jobRole.name }}</span>
          <!-- Archived means the user already applied to it. -->
          <UBadge v-if="match.archivedAt" color="neutral" variant="subtle" size="sm"
            >Applied</UBadge
          >
        </li>
      </ul>
      <!-- One Compare for the note: the modal's "Compare with" switches between matches. -->
      <div class="mt-3 flex flex-wrap gap-2">
        <UButton
          icon="i-lucide-columns-2"
          :disabled="disabled"
          :data-testid="`${testidPrefix}-compare`"
          @click="$emit('compare')"
          >Compare{{ matches.length > 1 ? ` (${matches.length})` : '' }}</UButton
        >
        <UButton color="neutral" variant="subtle" :disabled="disabled" @click="$emit('keep')"
          >Keep both</UButton
        >
        <UButton
          color="error"
          variant="soft"
          :disabled="disabled"
          :data-testid="`${testidPrefix}-remove-duplicate`"
          @click="$emit('remove')"
          >Remove new one</UButton
        >
      </div>
    </template>
  </UAlert>
</template>

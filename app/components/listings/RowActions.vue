<script setup lang="ts">
import type { ListingListItem } from '~/composables/useListingsList'

// Archive + view ad, shared by the phone/tablet row and the desktop table. Each instance owns its
// mutation, so only the clicked row shows a spinner.
const { listing } = defineProps<{ listing: ListingListItem }>()
const emit = defineEmits<{ changed: [] }>()

const SET_ARCHIVED = graphql(`
  mutation SetListingArchivedFromList($input: SetListingArchivedInput!) {
    setListingArchived(input: $input) {
      listing {
        id
        archivedAt
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

const notify = useAppToast()
const { run, loading: archiving } = useMutation(() => emit('changed'))

// The row leaves the current view, so archiving offers Undo (the reverse call). Unarchiving, or
// that Undo, only confirms: an undo of an undo would go round in circles.
const setArchived = async (isArchived: boolean) => {
  const ok = await run(async () => {
    const { setListingArchived } = await gql(SET_ARCHIVED, {
      input: { id: listing.id, isArchived }
    })
    return setListingArchived.errors
  })
  if (!ok) return
  emit('changed')
  if (isArchived)
    notify.undoable(`Archived ${listing.title}`, undoArchive, { icon: 'i-lucide-archive' })
  else notify.success(`Unarchived ${listing.title}`)
}
// By the time Undo is pressed the archived row has usually left the list, so this component is
// unmounted and its `changed` emit goes nowhere; refresh the list (useListingsList) by its key.
const undoArchive = async () => {
  await setArchived(false)
  await refreshNuxtData('listings')
}
</script>

<template>
  <div class="flex gap-1">
    <UButton
      variant="ghost"
      color="neutral"
      :icon="listing.archivedAt ? 'i-lucide-archive-restore' : 'i-lucide-archive'"
      :aria-label="`${listing.archivedAt ? 'Unarchive' : 'Archive'} ${listing.title}`"
      :loading="archiving"
      data-testid="listing-archive"
      @click="setArchived(!listing.archivedAt)"
    />
    <UButton
      v-if="listing.url"
      :to="listing.url"
      target="_blank"
      rel="noopener"
      variant="ghost"
      color="neutral"
      icon="i-lucide-external-link"
      :aria-label="`View ad for ${listing.title}`"
      data-testid="listing-view-ad"
    />
  </div>
</template>

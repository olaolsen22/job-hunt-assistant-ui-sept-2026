<script setup lang="ts">
// The add page's possible duplicates, shown on the page of the listing it just created. It stays
// until the owner decides, because keeping or removing can't be answered by a passing toast.
const { listingId } = defineProps<{ listingId: number }>()

const pending = usePossibleDuplicates()
const current = computed(() => (pending.value?.listing.id === listingId ? pending.value : null))

// The dashboard panel keeps its scroll position across pages, so the long add form would leave this
// above the fold.
const notice = useTemplateRef('notice')
onMounted(() => notice.value?.scrollIntoView({ block: 'center' }))

const toastSuccess = useSuccessToast()
const listingsView = useListingsView()
const { remove, deleting } = useDeleteListing()

const compareOpen = ref(false)
const compareId = ref(0)
const openCompare = () => {
  compareId.value = current.value!.matches[0]!.id
  compareOpen.value = true
}
const keepBoth = () => {
  compareOpen.value = false
  pending.value = null
  toastSuccess('Kept both listings')
}

const confirmOpen = ref(false)
const removeNew = async () => {
  const removed = await remove(listingId)
  confirmOpen.value = false
  if (!removed) return
  compareOpen.value = false
  pending.value = null
  toastSuccess('Listing removed')
  await navigateTo(listingsView.value, { replace: true })
}

// Removing an existing match shows the next one, or closes once none are left.
const onCompareRemove = async (side: 'new' | 'existing') => {
  if (side === 'new') return removeNew()
  const id = compareId.value
  if (!(await remove(id))) return
  const rest = current.value!.matches.filter((m) => m.id !== id)
  if (rest.length) {
    compareId.value = rest[0]!.id
    pending.value = { ...current.value!, matches: rest }
  } else {
    compareOpen.value = false
    pending.value = null
  }
  toastSuccess('Existing listing removed')
}
</script>

<template>
  <template v-if="current">
    <div ref="notice">
      <ListingsPossibleDuplicates
        :matches="current.matches"
        :disabled="deleting"
        testid-prefix="listing"
        @compare="openCompare"
        @keep="keepBoth"
        @remove="confirmOpen = true"
      />
    </div>
    <ListingsCompareModal
      v-model:open="compareOpen"
      v-model:match-id="compareId"
      :listing="current.listing"
      :matches="current.matches"
      :loading="deleting"
      @keep="keepBoth"
      @remove="onCompareRemove"
    />
    <AppConfirmModal
      v-model:open="confirmOpen"
      title="Remove this listing?"
      :description="current.listing.title"
      confirm-label="Remove"
      :loading="deleting"
      @confirm="removeNew"
    />
  </template>
</template>

<script setup lang="ts">
import type { ListingListItem } from '~/composables/useListingsList'
import { ERROR_MESSAGES } from '~/constants/errorMessages'

const { listing } = defineProps<{ listing: ListingListItem }>()

const SET_LISTING_FAVORITE = `
  mutation SetListingFavorite($input: SetListingFavoriteInput!) {
    setListingFavorite(input: $input) {
      listing { id favoritedAt }
      errors { __typename ... on Error { message } }
    }
  }
`

interface SetListingFavoriteResult {
  setListingFavorite: {
    listing: { id: number; favoritedAt: string | null } | null
    errors: { message: string }[] | null
  }
}

const toast = useToast()
// Props are read-only, so the card keeps its own copy to flip optimistically.
const favoritedAt = ref(listing.favoritedAt)
const saving = ref(false)

const toggleFavorite = async () => {
  const previous = favoritedAt.value
  favoritedAt.value = previous ? null : new Date().toISOString()
  saving.value = true
  try {
    const { setListingFavorite } = await gql<SetListingFavoriteResult>(SET_LISTING_FAVORITE, {
      input: { id: listing.id, isFavorite: !previous }
    })
    if (setListingFavorite.errors?.length || !setListingFavorite.listing) {
      favoritedAt.value = previous
      toast.add({
        title: setListingFavorite.errors?.[0]?.message ?? ERROR_MESSAGES.generic,
        color: 'error'
      })
      return
    }
    favoritedAt.value = setListingFavorite.listing.favoritedAt
  } catch {
    favoritedAt.value = previous
    toast.add({ title: ERROR_MESSAGES.generic, color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UCard data-testid="listing-card">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0 space-y-2">
        <div class="flex items-start gap-1">
          <h3 class="font-semibold text-highlighted">{{ listing.title }}</h3>
          <UButton
            size="xs"
            variant="ghost"
            :color="favoritedAt ? 'warning' : 'neutral'"
            :disabled="saving"
            class="shrink-0"
            :aria-label="favoritedAt ? 'Remove from favorites' : 'Add to favorites'"
            :aria-pressed="!!favoritedAt"
            data-testid="listing-favorite"
            @click="toggleFavorite"
          >
            <!-- Lucide has no filled star, and the default CSS-mask icon mode ignores `fill`,
                 so render it as inline SVG. The arbitrary variant is needed because the
                 icon's inner elements set fill="none" themselves, which blocks inheritance. -->
            <UIcon
              name="i-lucide-star"
              mode="svg"
              class="size-4"
              :class="{ '[&_*]:fill-current': favoritedAt }"
            />
          </UButton>
        </div>

        <p class="flex items-center gap-1.5 text-sm text-muted">
          <UIcon name="i-lucide-building-2" class="size-4 shrink-0" />
          {{ listing.company.name }}
        </p>

        <ListingsLocation :listing="listing" />

        <ListingsDates :listing="listing" />
      </div>

      <UButton
        :to="listing.url"
        target="_blank"
        rel="noopener"
        variant="ghost"
        color="neutral"
        icon="i-lucide-external-link"
        class="shrink-0"
        aria-label="View posting"
      />
    </div>
  </UCard>
</template>

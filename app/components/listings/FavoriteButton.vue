<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'

const { id, favoritedAt: initialFavoritedAt } = defineProps<{
  id: number
  favoritedAt: string | null
}>()

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
// Props are read-only, so the button keeps its own copy to flip optimistically.
const favoritedAt = ref(initialFavoritedAt)
const saving = ref(false)

const toggleFavorite = async () => {
  const previous = favoritedAt.value
  favoritedAt.value = previous ? null : new Date().toISOString()
  saving.value = true
  try {
    const { setListingFavorite } = await gql<SetListingFavoriteResult>(SET_LISTING_FAVORITE, {
      input: { id, isFavorite: !previous }
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
  <UButton
    size="xs"
    variant="ghost"
    :color="favoritedAt ? 'warning' : 'neutral'"
    :disabled="saving"
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
</template>

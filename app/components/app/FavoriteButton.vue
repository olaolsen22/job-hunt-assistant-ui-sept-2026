<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'

// The star on a company or listing: flips at once and goes back if the API refuses.
const {
  target,
  id,
  favoritedAt: initialFavoritedAt,
  size = 'xs'
} = defineProps<{
  target: 'company' | 'listing'
  id: number
  favoritedAt: string | null
  // Detail headers use a bigger tap target than list rows.
  size?: 'xs' | 'md'
}>()

const SET_COMPANY_FAVORITE = graphql(`
  mutation SetCompanyFavorite($input: SetCompanyFavoriteInput!) {
    setCompanyFavorite(input: $input) {
      company {
        id
        favoritedAt
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

const SET_LISTING_FAVORITE = graphql(`
  mutation SetListingFavorite($input: SetListingFavoriteInput!) {
    setListingFavorite(input: $input) {
      listing {
        id
        favoritedAt
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

// Both answer with the saved favoritedAt, or the errors when nothing was saved.
const save = async (isFavorite: boolean) => {
  const input = { id, isFavorite }
  if (target === 'company') {
    const { setCompanyFavorite: payload } = await gql(SET_COMPANY_FAVORITE, { input })
    return { errors: payload.errors, saved: payload.company }
  }
  const { setListingFavorite: payload } = await gql(SET_LISTING_FAVORITE, { input })
  return { errors: payload.errors, saved: payload.listing }
}

const notify = useAppToast()
// Props are read-only, so the button keeps its own copy to flip optimistically.
const favoritedAt = ref(initialFavoritedAt)
const saving = ref(false)
// A list can hand this button another row's data (UTable reuses row components by position, so
// toggling the Favorites filter swaps the listing under it), so the copy follows the prop.
watch(
  () => initialFavoritedAt,
  (value) => (favoritedAt.value = value)
)

const toggleFavorite = async () => {
  const previous = favoritedAt.value
  favoritedAt.value = previous ? null : new Date().toISOString()
  saving.value = true
  try {
    const { errors, saved } = await save(!previous)
    if (errors?.length || !saved) {
      favoritedAt.value = previous
      notify.error(errors?.[0]?.message ?? ERROR_MESSAGES.generic)
      return
    }
    favoritedAt.value = saved.favoritedAt
  } catch {
    favoritedAt.value = previous
    notify.error(ERROR_MESSAGES.generic)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UButton
    :size="size"
    variant="ghost"
    :color="favoritedAt ? 'warning' : 'neutral'"
    :disabled="saving"
    :aria-label="favoritedAt ? 'Remove from favorites' : 'Add to favorites'"
    :aria-pressed="!!favoritedAt"
    :data-testid="`${target}-favorite`"
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

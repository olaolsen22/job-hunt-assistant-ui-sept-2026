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

const toast = useToast()
// Props are read-only, so the button keeps its own copy to flip optimistically.
const favoritedAt = ref(initialFavoritedAt)
const saving = ref(false)

const toggleFavorite = async () => {
  const previous = favoritedAt.value
  favoritedAt.value = previous ? null : new Date().toISOString()
  saving.value = true
  try {
    const { errors, saved } = await save(!previous)
    if (errors?.length || !saved) {
      favoritedAt.value = previous
      toast.add({ title: errors?.[0]?.message ?? ERROR_MESSAGES.generic, color: 'error' })
      return
    }
    favoritedAt.value = saved.favoritedAt
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

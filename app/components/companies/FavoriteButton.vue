<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'

const { id, favoritedAt: initialFavoritedAt } = defineProps<{
  id: number
  favoritedAt: string | null
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

const toast = useToast()
// Props are read-only, so the button keeps its own copy to flip optimistically.
const favoritedAt = ref(initialFavoritedAt)
const saving = ref(false)

const toggleFavorite = async () => {
  const previous = favoritedAt.value
  favoritedAt.value = previous ? null : new Date().toISOString()
  saving.value = true
  try {
    const { setCompanyFavorite } = await gql(SET_COMPANY_FAVORITE, {
      input: { id, isFavorite: !previous }
    })
    if (setCompanyFavorite.errors?.length || !setCompanyFavorite.company) {
      favoritedAt.value = previous
      toast.add({
        title: setCompanyFavorite.errors?.[0]?.message ?? ERROR_MESSAGES.generic,
        color: 'error'
      })
      return
    }
    favoritedAt.value = setCompanyFavorite.company.favoritedAt
  } catch {
    favoritedAt.value = previous
    toast.add({ title: ERROR_MESSAGES.generic, color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <!-- The row is a <NuxtLink>: .prevent stops the anchor navigating, .stop keeps the router link's own click handler out of it. -->
  <UButton
    size="xs"
    variant="ghost"
    :color="favoritedAt ? 'warning' : 'neutral'"
    :disabled="saving"
    :aria-label="favoritedAt ? 'Remove from favorites' : 'Add to favorites'"
    :aria-pressed="!!favoritedAt"
    data-testid="company-favorite"
    @click.prevent.stop="toggleFavorite"
  >
    <!-- Same inline-SVG star as the listing button: Lucide has no filled star and the CSS-mask mode ignores `fill`. -->
    <UIcon
      name="i-lucide-star"
      mode="svg"
      class="size-4"
      :class="{ '[&_*]:fill-current': favoritedAt }"
    />
  </UButton>
</template>

<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'

const {
  id,
  shortlistedAt: initialShortlistedAt,
  size = 'xs'
} = defineProps<{
  id: number
  shortlistedAt: string | null
  size?: 'xs' | 'md'
}>()
const emit = defineEmits<{ changed: [] }>()

const SET_LISTING_SHORTLISTED = graphql(`
  mutation SetListingShortlisted($input: SetListingShortlistedInput!) {
    setListingShortlisted(input: $input) {
      listing {
        id
        shortlistedAt
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
const shortlistedAt = ref(initialShortlistedAt)
const saving = ref(false)
watch(
  () => [id, initialShortlistedAt] as const,
  () => {
    shortlistedAt.value = initialShortlistedAt
  }
)

const toggle = async () => {
  if (saving.value) return
  const previous = shortlistedAt.value
  const listingId = id
  shortlistedAt.value = previous ? null : new Date().toISOString()
  saving.value = true
  try {
    const { setListingShortlisted: payload } = await gql(SET_LISTING_SHORTLISTED, {
      input: { id: listingId, isShortlisted: !previous }
    })
    if (payload.errors?.length || !payload.listing) {
      if (id === listingId) shortlistedAt.value = previous
      notify.error(payload.errors?.[0]?.message ?? ERROR_MESSAGES.generic)
      return
    }
    if (id === listingId) shortlistedAt.value = payload.listing.shortlistedAt
    emit('changed')
  } catch {
    if (id === listingId) shortlistedAt.value = previous
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
    :color="shortlistedAt ? 'primary' : 'neutral'"
    :disabled="saving"
    :aria-label="shortlistedAt ? 'Remove from shortlist' : 'Add to shortlist'"
    :aria-pressed="!!shortlistedAt"
    data-testid="listing-shortlist"
    @click="toggle"
  >
    <UIcon
      name="i-lucide-bookmark"
      mode="svg"
      class="size-4"
      :class="{ '[&_*]:fill-current': shortlistedAt }"
    />
  </UButton>
</template>

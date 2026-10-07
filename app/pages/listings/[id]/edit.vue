<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'

definePageMeta({ title: 'Edit listing' })

const UPDATE_LISTING = graphql(`
  mutation UpdateListing($id: Int!, $listing: ListingInput!) {
    updateListing(input: { id: $id, listing: $listing }) {
      listing {
        id
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

const route = useRoute()
const router = useRouter()
const id = Number(route.params.id)

const { listing, loading, error } = await useListing(id)
const { state, validate, toInput, fill, mergeDraft } = useListingForm()
const { checkNewNames } = provideNewNames()

const parseOpen = ref(false)

// The listing loads client-side after setup, so fill the form once it arrives. The detail page's
// "Analyze" links here with ?analyze; open the parser only after the fill, or the fill would
// overwrite a merged parse.
watch(
  listing,
  (l) => {
    if (!l) return
    fill(l)
    if ('analyze' in route.query) parseOpen.value = true
  },
  { immediate: true }
)

const toast = useToast()
const listingForm = useTemplateRef('listingForm')

const filledFromAd = ref(false)

const onDraft = (draft: Record<string, unknown>) => {
  mergeDraft(draft)
  listingForm.value?.validate()
  filledFromAd.value = true
  checkNewNames(state)
}
const submitting = ref(false)
const errorMessages = ref<string[]>([])
const confirmOpen = ref(false)

const onConfirm = async () => {
  submitting.value = true
  errorMessages.value = []
  try {
    const { updateListing } = await gql(UPDATE_LISTING, {
      id,
      listing: toInput()
    })
    if (updateListing.errors?.length) {
      confirmOpen.value = false
      errorMessages.value = updateListing.errors.map((e) => e.message)
      return
    }
    clearNuxtState('name-lookups')
    // The detail page shares this key and mounts before this page unmounts, so it would reuse the
    // pre-edit data instead of fetching.
    await refreshNuxtData(`listing-${id}`)
    toast.add({ title: 'Listing saved', color: 'success', icon: 'i-lucide-check' })
    // Opened from the detail page: step back to that entry. Pushing or replacing would leave a second
    // copy of the detail page in history, so Back would need two presses to reach the list.
    if (router.options.history.state.back === `/listings/${id}`) {
      router.back()
    } else {
      await navigateTo(`/listings/${id}`, { replace: true })
    }
  } catch {
    confirmOpen.value = false
    errorMessages.value = [ERROR_MESSAGES.generic]
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <UAlert
      v-if="error"
      color="error"
      :description="ERROR_MESSAGES.generic"
      class="w-full max-w-3xl"
    />

    <UAlert
      v-else-if="!loading && !listing"
      color="error"
      title="Listing not found"
      description="It may have been deleted."
      class="w-full max-w-3xl"
    />

    <USkeleton
      v-else-if="loading"
      class="h-96 w-full max-w-3xl"
      data-testid="edit-listing-loading"
    />

    <template v-else>
      <!-- Stacked below sm so Back never shares a line with Analyze ad on a phone. -->
      <div
        class="flex w-full max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <UButton
          :to="`/listings/${id}`"
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          class="self-start"
          data-testid="edit-listing-back"
          >Back</UButton
        >
        <UButton
          icon="i-lucide-sparkles"
          color="neutral"
          variant="subtle"
          class="self-start"
          data-testid="parse-open"
          @click="parseOpen = true"
          >Analyze ad</UButton
        >
      </div>

      <!-- The saved title, not the form's, so the heading doesn't change while typing. -->
      <div class="w-full max-w-3xl">
        <h1 class="break-words text-xl font-semibold text-highlighted">{{ listing?.title }}</h1>
        <p class="text-sm text-muted">{{ listing?.company.name }}</p>
      </div>

      <UAlert
        v-if="filledFromAd"
        color="info"
        variant="subtle"
        icon="i-lucide-sparkles"
        title="Filled from the ad"
        description="Fields the ad didn’t mention kept their saved values. Nothing is saved yet; saving marks the listing analyzed."
        close
        class="w-full max-w-3xl"
        data-testid="filled-from-ad"
        @update:open="filledFromAd = $event"
      />

      <ListingsForm
        ref="listingForm"
        v-model="state"
        :validate="validate"
        submit-label="Save changes"
        :cancel-to="`/listings/${id}`"
        data-testid="edit-listing-form"
        @submit="confirmOpen = true"
      >
        <UAlert
          v-if="errorMessages.length"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="errorMessages.join(' ')"
          data-testid="edit-listing-error"
        />
      </ListingsForm>
    </template>

    <ListingsParseModal v-model:open="parseOpen" :listing-id="id" @apply="onDraft" />

    <AppConfirmModal
      v-model:open="confirmOpen"
      title="Save changes?"
      :description="`${state.title} at ${state.companyName}`"
      confirm-label="Save changes"
      :loading="submitting"
      @confirm="onConfirm"
    />
  </div>
</template>

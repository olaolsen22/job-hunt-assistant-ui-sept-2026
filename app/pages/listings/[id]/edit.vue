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

const onDraft = (draft: Record<string, unknown>) => {
  mergeDraft(draft)
  listingForm.value?.validate()
  toast.add({ title: 'Form filled from the ad', color: 'success', icon: 'i-lucide-check' })
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
    toast.add({ title: 'Listing saved', color: 'success', icon: 'i-lucide-check' })
    await navigateTo(`/listings/${id}`)
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
      <div class="flex w-full max-w-3xl justify-end">
        <UButton
          icon="i-lucide-sparkles"
          color="neutral"
          variant="subtle"
          data-testid="parse-open"
          @click="parseOpen = true"
          >Paste from ad</UButton
        >
      </div>

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

    <ListingsParseModal v-model:open="parseOpen" @apply="onDraft" />

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

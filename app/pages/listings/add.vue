<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'

definePageMeta({ title: 'Add listing' })

const CREATE_LISTING = `
  mutation CreateListing($listing: ListingInput!) {
    createListing(input: { listing: $listing }) {
      listing { id }
      errors { __typename ... on Error { message } }
    }
  }
`

interface CreateListingResult {
  createListing: { listing: { id: number } | null; errors: { message: string }[] | null }
}

const { state, validate, toInput } = useListingForm()

const toast = useToast()
const submitting = ref(false)
const errorMessages = ref<string[]>([])
const confirmOpen = ref(false)

const onConfirm = async () => {
  submitting.value = true
  errorMessages.value = []
  try {
    const { createListing } = await gql<CreateListingResult>(CREATE_LISTING, {
      listing: toInput()
    })
    if (createListing.errors?.length) {
      confirmOpen.value = false
      errorMessages.value = createListing.errors.map((e) => e.message)
      return
    }
    clearNuxtState('name-lookups')
    toast.add({ title: 'Listing added', color: 'success', icon: 'i-lucide-check' })
    await navigateTo('/listings')
  } catch {
    confirmOpen.value = false
    errorMessages.value = [ERROR_MESSAGES.generic]
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex justify-center">
    <ListingsForm
      v-model="state"
      :validate="validate"
      submit-label="Add listing"
      cancel-to="/listings"
      data-testid="add-listing-form"
      @submit="confirmOpen = true"
    >
      <UAlert
        v-if="errorMessages.length"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="errorMessages.join(' ')"
        data-testid="add-listing-error"
      />
    </ListingsForm>

    <AppConfirmModal
      v-model:open="confirmOpen"
      title="Add this listing?"
      :description="`${state.title} at ${state.companyName}`"
      confirm-label="Add listing"
      :loading="submitting"
      @confirm="onConfirm"
    />
  </div>
</template>

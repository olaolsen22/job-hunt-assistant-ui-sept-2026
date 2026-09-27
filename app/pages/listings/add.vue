<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'

definePageMeta({ title: 'Add listing' })

const CREATE_LISTING = graphql(`
  mutation CreateListing($listing: ListingInput!) {
    createListing(input: { listing: $listing }) {
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

const { state, validate, toInput, fillDraft } = useListingForm()
const { checkNewNames } = provideNewNames()

const toast = useToast()
const parseOpen = ref(false)
const listingForm = useTemplateRef('listingForm')

const onDraft = (draft: Record<string, unknown>) => {
  fillDraft(draft)
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
    const { createListing } = await gql(CREATE_LISTING, {
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
  <div class="flex flex-col items-center gap-4">
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

    <ListingsParseModal v-model:open="parseOpen" @apply="onDraft" />

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

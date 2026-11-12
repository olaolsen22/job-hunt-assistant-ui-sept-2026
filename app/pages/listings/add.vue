<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { APPLICATION_STATUS_OPTIONS } from '~/constants/listing'

definePageMeta({ title: 'Add listing' })

const listingsView = useListingsView()

const CREATE_LISTING = graphql(
  `
    mutation CreateListing($listing: ListingInput!) {
      createListing(input: { listing: $listing }) {
        listing {
          ...ListingCompareFields
        }
        previousAttempts {
          id
          status
        }
        possibleDuplicates {
          ...ListingCompareFields
          archivedAt
        }
        errors {
          __typename
          ... on Error {
            message
          }
          ... on DuplicateListingError {
            existingListingId
          }
        }
      }
    }
  `,
  [LISTING_COMPARE_FIELDS]
)

// "Start open application" on a person's page links here with ?contact=<id>.
const CONTACT_FOR_LISTING = graphql(`
  query ContactForListing($id: Int!) {
    contactById(id: $id) {
      name
      title
      email
      phone
      url
      company {
        name
      }
    }
  }
`)

const { state, validate, toInput, fillDraft } = useListingForm()
const { checkNewNames } = provideNewNames()

const notify = useAppToast()
const toastDuplicate = useDuplicateListingToast()
const parseOpen = ref(false)
const listingForm = useTemplateRef('listingForm')

const filledFromAd = ref(false)

// An open application to that person: their company, and them as the first linked contact, which
// the cover letter is addressed to. The row stays removable like any other contact.
const route = useRoute()
const contactId = Number(route.query.contact) || null
const addressedTo = ref('')
const backTo = computed(() => (contactId ? `/contacts/${contactId}` : listingsView.value))
onMounted(async () => {
  if (!contactId) return
  try {
    const { contactById: c } = await gql(CONTACT_FOR_LISTING, { id: contactId })
    if (!c) return
    state.kind = 'OPEN_INVITATION'
    state.companyName = c.company.name
    state.contacts = [{ name: c.name, title: c.title, email: c.email, phone: c.phone, url: c.url }]
    addressedTo.value = c.name
  } catch {
    notify.error(ERROR_MESSAGES.generic)
  }
})

const onDraft = (draft: Record<string, unknown>, url?: string) => {
  fillDraft(draft)
  if (url) state.url = url
  listingForm.value?.validate()
  filledFromAd.value = true
  checkNewNames(state)
}
const possibleDuplicates = usePossibleDuplicates()
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
      if (!toastDuplicate(createListing.errors))
        errorMessages.value = createListing.errors.map((e) => e.message)
      return
    }
    clearNuxtState('name-lookups')
    // The new listing's page asks what to do about them.
    possibleDuplicates.value = createListing.possibleDuplicates?.length
      ? { listing: createListing.listing!, matches: [...createListing.possibleDuplicates] }
      : null
    // Newest first, so [0] is the latest earlier attempt at this posting.
    const previous = createListing.previousAttempts?.[0]
    notify.success(
      'Listing added',
      previous && {
        description: `You closed an earlier listing for this URL (${APPLICATION_STATUS_OPTIONS.find((o) => o.value === previous.status)!.label}).`,
        icon: 'i-lucide-history',
        action: { label: 'View previous attempt', to: `/listings/${previous.id}` }
      }
    )
    await navigateTo(`/listings/${createListing.listing!.id}`, { replace: true })
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
    <!-- Stacked below sm so Back never shares a line with the actions on a phone. -->
    <div
      class="flex w-full max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
    >
      <UButton
        :to="backTo"
        icon="i-lucide-arrow-left"
        variant="ghost"
        color="neutral"
        class="self-start"
        data-testid="add-listing-back"
      >
        Back
      </UButton>
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

    <UAlert
      v-if="filledFromAd"
      color="info"
      variant="subtle"
      icon="i-lucide-sparkles"
      title="Filled from the ad"
      description="Nothing is saved yet. Check the fields, then add the listing."
      close
      class="w-full max-w-3xl"
      data-testid="filled-from-ad"
      @update:open="filledFromAd = $event"
    />

    <UAlert
      v-if="addressedTo && state.contacts[0]?.name === addressedTo"
      color="info"
      variant="subtle"
      icon="i-lucide-send"
      title="Open application"
      :description="`The cover letter will be addressed to ${addressedTo}. Add a title and role, then save.`"
      class="w-full max-w-3xl"
      data-testid="open-application-notice"
    />

    <ListingsForm
      ref="listingForm"
      v-model="state"
      :validate="validate"
      submit-label="Add listing"
      :cancel-to="contactId ? backTo : '/listings'"
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

    <ListingsParseModal v-model:open="parseOpen" :url="state.url" @apply="onDraft" />

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

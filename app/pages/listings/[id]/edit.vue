<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'

definePageMeta({ title: 'Edit listing' })

const route = useRoute()
const router = useRouter()
const id = Number(route.params.id)

const { listing, loading, error } = await useListing(id)
const { state, validate, toInput, fill, mergeDraft } = useListingForm()
const { checkNewNames } = provideNewNames()

const adLink = computed(() => {
  const url = state.url.trim()
  return isHttpUrl(url) ? url : undefined
})

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

const toastSuccess = useSuccessToast()
const toastDuplicate = useDuplicateListingToast()
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
      if (!toastDuplicate(updateListing.errors))
        errorMessages.value = updateListing.errors.map((e) => e.message)
      return
    }
    clearNuxtState('name-lookups')
    // The detail page shares this key and mounts before this page unmounts, so it would reuse the
    // pre-edit data instead of fetching.
    await refreshNuxtData(`listing-${id}`)
    toastSuccess('Listing saved')
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
    <!-- Stacked below sm so Back never shares a line with Analyze ad on a phone. Above the
         states so Back still shows on an error: the installed app has no browser Back. -->
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
        v-if="!error && !loading && listing"
        icon="i-lucide-sparkles"
        color="neutral"
        variant="subtle"
        class="self-start"
        data-testid="parse-open"
        @click="parseOpen = true"
        >{{ listing?.analyzedAt ? 'Re-analyze ad' : 'Analyze ad' }}</UButton
      >
    </div>

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
        <template #url-action>
          <UButton
            :to="adLink"
            :disabled="!adLink"
            target="_blank"
            rel="noopener noreferrer"
            icon="i-lucide-external-link"
            color="neutral"
            variant="outline"
            aria-label="Open ad link in a new tab"
            title="Open ad link in a new tab"
            class="shrink-0"
            data-testid="edit-listing-open-ad"
          />
        </template>
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

    <ListingsParseModal
      v-model:open="parseOpen"
      :listing-id="id"
      :url="state.url"
      @apply="onDraft"
    />

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

<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import {
  DEADLINE_TYPE_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  LANGUAGE_OPTIONS,
  SCHEDULE_OPTIONS,
  SENIORITY_OPTIONS,
  WORK_MODE_OPTIONS
} from '~/constants/listing'

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
    <UForm
      :state="state"
      :validate="validate"
      class="w-full max-w-3xl space-y-4 sm:space-y-6 lg:max-w-6xl"
      data-testid="add-listing-form"
      @submit="confirmOpen = true"
    >
      <div
        class="space-y-4 sm:space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0"
      >
        <AppCard title="Job">
          <div class="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <UFormField label="Job title" name="title" required class="sm:col-span-2">
              <UInput v-model="state.title" placeholder="As written in the ad" class="w-full" />
            </UFormField>

            <UFormField label="Company" name="companyName" required>
              <ListingsNameCombobox
                v-model="state.companyName"
                lookup="companies"
                placeholder="Search or add company"
              />
            </UFormField>

            <UFormField label="Role" name="jobRoleName" required>
              <ListingsNameCombobox
                v-model="state.jobRoleName"
                lookup="jobRoles"
                placeholder="Search or add role"
              />
            </UFormField>

            <UFormField label="Job ad URL" name="url" required class="sm:col-span-2">
              <UInput v-model="state.url" type="url" placeholder="https://" class="w-full" />
            </UFormField>

            <UFormField label="Seniority" name="seniority">
              <USelect
                v-model="state.seniority"
                :items="[...SENIORITY_OPTIONS]"
                placeholder="Not stated"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Employment type" name="employmentType">
              <USelect
                v-model="state.employmentType"
                :items="[...EMPLOYMENT_TYPE_OPTIONS]"
                placeholder="Not stated"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Schedule" name="schedule">
              <ListingsToggleGroup v-model="state.schedule" :options="SCHEDULE_OPTIONS" />
            </UFormField>

            <UFormField label="Work mode" name="workMode">
              <ListingsToggleGroup v-model="state.workMode" :options="WORK_MODE_OPTIONS" />
            </UFormField>

            <UFormField
              label="Language requirements"
              description="Languages the candidate should speak (not the ad's own language)"
              name="languages"
              class="sm:col-span-2"
            >
              <ListingsLanguagesField v-model="state.languages" />
            </UFormField>
          </div>
        </AppCard>

        <AppCard title="Location & timing">
          <div class="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <UFormField label="Locations" name="locations" class="sm:col-span-2">
              <ListingsLocationsField v-model="state.locations" />
            </UFormField>

            <UFormField label="Posted on" name="postedOn">
              <UInput v-model="state.postedOn" type="date" class="w-full" />
            </UFormField>

            <UFormField
              label="Ad language"
              help="Language the ad is written in"
              name="postingLanguage"
            >
              <USelect
                v-model="state.postingLanguage"
                :items="[...LANGUAGE_OPTIONS]"
                placeholder="Not stated"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Deadline" name="deadlineType">
              <USelect
                v-model="state.deadlineType"
                :items="[...DEADLINE_TYPE_OPTIONS]"
                class="w-full"
              />
            </UFormField>

            <UFormField
              v-if="state.deadlineType === 'DATE'"
              label="Deadline date"
              name="deadlineOn"
            >
              <UInput v-model="state.deadlineOn" type="date" class="w-full" />
            </UFormField>
          </div>
        </AppCard>
      </div>

      <AppCard title="Skills">
        <ListingsSkillsField v-model="state.skills" />
      </AppCard>

      <AppCard title="Description">
        <UTextarea
          v-model="state.description"
          :rows="6"
          autoresize
          placeholder="Paste the job ad text here"
          class="w-full"
        />
      </AppCard>

      <UAlert
        v-if="errorMessages.length"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="errorMessages.join(' ')"
        data-testid="add-listing-error"
      />

      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <UButton to="/listings" color="neutral" variant="ghost" class="justify-center sm:w-auto"
          >Cancel</UButton
        >
        <UButton type="submit" class="justify-center sm:w-auto">Add listing</UButton>
      </div>
    </UForm>

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

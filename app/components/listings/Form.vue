<script setup lang="ts">
import type { FormError } from '@nuxt/ui'
import {
  DEADLINE_TYPE_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  LANGUAGE_OPTIONS,
  SCHEDULE_OPTIONS,
  SENIORITY_OPTIONS,
  WORK_MODE_OPTIONS
} from '~/constants/listing'

type ListingFormState = ReturnType<typeof useListingForm>['state']

// Fields and buttons only. The page owns the mutation, confirm modal and errors, which differ
// between add and edit; the default slot renders above the buttons for the error alert.
const state = defineModel<ListingFormState>({ required: true })
defineProps<{
  validate: (s: ListingFormState) => FormError[]
  submitLabel: string
  cancelTo: string
}>()
defineEmits<{ submit: [] }>()
</script>

<template>
  <UForm
    :state="state"
    :validate="validate"
    class="w-full max-w-3xl space-y-4 sm:space-y-6"
    @submit="$emit('submit')"
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

        <UFormField label="Locations" name="locations" class="sm:col-span-2">
          <ListingsLocationsField v-model="state.locations" />
        </UFormField>

        <UFormField label="Work mode" name="workMode">
          <ListingsToggleGroup v-model="state.workMode" :options="WORK_MODE_OPTIONS" />
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

        <UFormField label="Seniority" name="seniority">
          <USelect
            v-model="state.seniority"
            :items="[...SENIORITY_OPTIONS]"
            placeholder="Not stated"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Language requirements" name="languages" class="sm:col-span-2">
          <ListingsLanguagesField v-model="state.languages" />
        </UFormField>

        <UFormField label="Ad language" help="Language the ad is written in" name="postingLanguage">
          <USelect
            v-model="state.postingLanguage"
            :items="[...LANGUAGE_OPTIONS]"
            placeholder="Not stated"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Posted on" name="postedOn" required class="sm:col-start-1">
          <UInput v-model="state.postedOn" type="date" :max="todayIso()" class="w-full" />
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
          class="sm:col-start-2"
        >
          <UInput v-model="state.deadlineOn" type="date" class="w-full" />
        </UFormField>
      </div>
    </AppCard>

    <AppCard title="Skills">
      <ListingsSkillsField v-model="state.skills" />
    </AppCard>

    <AppCard title="Summary">
      <UFormField name="description" help="Short summary, not the full ad text">
        <UTextarea
          v-model="state.description"
          :rows="3"
          autoresize
          placeholder="A few sentences on the role, in your own words"
          class="w-full"
        />
      </UFormField>
    </AppCard>

    <slot />

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <UButton :to="cancelTo" color="neutral" variant="ghost" class="justify-center sm:w-auto"
        >Cancel</UButton
      >
      <UButton type="submit" class="justify-center sm:w-auto">{{ submitLabel }}</UButton>
    </div>
  </UForm>
</template>

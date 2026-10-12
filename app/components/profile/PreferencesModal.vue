<script setup lang="ts">
import { EMPLOYMENT_TYPE_OPTIONS, WORK_MODE_OPTIONS } from '~/constants/listing'
import type { ProfileData } from '~/composables/useProfile'

const { profile } = defineProps<{ profile: ProfileData }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [profile: ProfileData]; changed: [] }>()

const UPDATE_PREFERENCES = graphql(
  `
    mutation UpdateProfilePreferences($input: UpdateProfilePreferencesInput!) {
      updateProfilePreferences(input: $input) {
        profile {
          ...ProfileFields
        }
        errors {
          __typename
          ... on Error {
            message
          }
        }
      }
    }
  `,
  [PROFILE_FIELDS]
)

const jobRoles = ref<string[]>([])
const workModes = ref<ProfileData['workModes']>([])
const employmentTypes = ref<ProfileData['employmentTypes']>([])
const minSalary = ref<number | null>(null)
const currency = ref('')
const noticePeriod = ref<number | null>(null)

watch(open, (isOpen) => {
  if (!isOpen) return
  jobRoles.value = profile.jobRoles.map((r) => r.name)
  workModes.value = [...profile.workModes]
  employmentTypes.value = [...profile.employmentTypes]
  minSalary.value = profile.minSalary
  currency.value = profile.salaryCurrency ?? ''
  noticePeriod.value = profile.noticePeriodMonths
})

const namesField = useTemplateRef('namesField')

const state = computed(() => ({
  jobRoles: jobRoles.value,
  workModes: workModes.value,
  employmentTypes: employmentTypes.value,
  minSalary: minSalary.value,
  currency: currency.value,
  noticePeriod: noticePeriod.value
}))

const { run, loading } = useMutation(() => emit('changed'))

const submit = async () => {
  namesField.value?.commit()
  // Full replace: every field goes out, empty ones as null.
  const input = {
    jobRoleNames: jobRoles.value,
    workModes: workModes.value,
    employmentTypes: employmentTypes.value,
    minSalary: minSalary.value ?? null,
    salaryCurrency: currency.value.trim().toUpperCase() || null,
    noticePeriodMonths: noticePeriod.value ?? null
  }
  let saved: ProfileData | null = null
  const ok = await run(async () => {
    const { updateProfilePreferences } = await gql(UPDATE_PREFERENCES, { input })
    saved = updateProfilePreferences.profile
    return updateProfilePreferences.errors
  })
  if (!ok || !saved) return
  // A new job role is a new name, so the cached suggestions are stale.
  clearNuxtState('name-lookups')
  open.value = false
  emit('saved', saved)
}
</script>

<template>
  <AppFormModal
    v-model:open="open"
    title="Edit preferences"
    :state="state"
    :loading="loading"
    @submit="submit"
  >
    <div class="space-y-4">
      <UFormField label="Job roles">
        <ProfileNamesField
          ref="namesField"
          v-model="jobRoles"
          lookup="jobRoles"
          placeholder="Search or add a role"
        />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Work modes">
          <USelectMenu
            v-model="workModes"
            :items="[...WORK_MODE_OPTIONS]"
            value-key="value"
            multiple
            :search-input="false"
            placeholder="Any"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Employment types">
          <USelectMenu
            v-model="employmentTypes"
            :items="[...EMPLOYMENT_TYPE_OPTIONS]"
            value-key="value"
            multiple
            :search-input="false"
            placeholder="Any"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="grid grid-cols-3 gap-4">
        <UFormField label="Minimum salary" class="col-span-2">
          <UInputNumber
            v-model="minSalary"
            :min="0"
            :increment="false"
            :decrement="false"
            class="w-full"
            data-testid="prefs-salary"
          />
        </UFormField>
        <UFormField label="Currency">
          <UInput v-model="currency" :maxlength="3" placeholder="NOK" class="w-full uppercase" />
        </UFormField>
      </div>
      <UFormField label="Notice period (months)">
        <UInputNumber
          v-model="noticePeriod"
          :min="0"
          :max="12"
          :increment="false"
          :decrement="false"
          class="w-full"
        />
      </UFormField>
    </div>

    <template #after>
      <ProfileTargetLocations
        :locations="profile.targetLocations"
        class="mt-6 border-t border-default pt-4"
        @changed="emit('changed')"
      />
    </template>
  </AppFormModal>
</template>

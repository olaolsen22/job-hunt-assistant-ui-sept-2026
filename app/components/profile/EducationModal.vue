<script setup lang="ts">
import type { ProfileEducation } from '~/composables/useProfile'

// Without `education` it adds one; with it, it edits that one. Bullets are edited on the card.
const { education } = defineProps<{ education: ProfileEducation | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const ADD_EDUCATION = graphql(`
  mutation AddProfileEducation($input: AddProfileEducationInput!) {
    addProfileEducation(input: $input) {
      profileEducation {
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

const UPDATE_EDUCATION = graphql(`
  mutation UpdateProfileEducation($input: UpdateProfileEducationInput!) {
    updateProfileEducation(input: $input) {
      profileEducation {
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

const school = ref('')
const degree = ref('')
const field = ref('')
const countryCode = ref<string>()
const city = ref<string>()
const startMonth = ref<string | null>(null)
const endMonth = ref<string | null>(null)
const current = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  school.value = education?.school ?? ''
  degree.value = education?.degree ?? ''
  field.value = education?.field ?? ''
  countryCode.value = education?.location?.countryCode
  city.value = education?.location?.city ?? undefined
  startMonth.value = education?.startMonth ?? null
  endMonth.value = education?.endMonth ?? null
  current.value = !!education && !education.endMonth
})

watch(current, (isCurrent) => {
  if (isCurrent) endMonth.value = null
})

const { run, loading } = useMutation(() => emit('changed'))

const submit = async () => {
  const fields = {
    school: school.value.trim(),
    degree: degree.value.trim() || null,
    field: field.value.trim() || null,
    location: locationInput(countryCode.value, city.value),
    startMonth: startMonth.value!,
    endMonth: current.value ? null : endMonth.value
  }
  const ok = await run(async () => {
    if (education) {
      const { updateProfileEducation } = await gql(UPDATE_EDUCATION, {
        input: { id: education.id, ...fields }
      })
      return updateProfileEducation.errors
    }
    const { addProfileEducation } = await gql(ADD_EDUCATION, { input: fields })
    return addProfileEducation.errors
  })
  if (!ok) return
  open.value = false
  emit('changed')
}
</script>

<template>
  <AppConfirmModal
    v-model:open="open"
    :title="education ? 'Edit education' : 'Add education'"
    confirm-label="Save"
    :loading="loading"
    :disabled="!school.trim() || !startMonth"
    @confirm="submit"
  >
    <div class="space-y-4">
      <UFormField label="School" required>
        <UInput v-model="school" class="w-full" />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Degree">
          <UInput v-model="degree" class="w-full" />
        </UFormField>
        <UFormField label="Field of study">
          <UInput v-model="field" class="w-full" />
        </UFormField>
      </div>
      <ProfileLocationField v-model:country-code="countryCode" v-model:city="city" />
      <UFormField label="Start" required>
        <AppMonthField v-model="startMonth" />
      </UFormField>
      <UFormField label="End">
        <div class="space-y-2">
          <AppMonthField v-model="endMonth" :disabled="current" />
          <UCheckbox v-model="current" label="Current" />
        </div>
      </UFormField>
    </div>
  </AppConfirmModal>
</template>

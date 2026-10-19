<script setup lang="ts">
import type { ProfileEducation } from '~/composables/useProfile'

// Without `education` it adds one; with it, it edits that one. Its bullets save on their own.
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
const startPartial = ref(false)
const endPartial = ref(false)

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

const state = computed(() => ({
  school: school.value,
  degree: degree.value,
  field: field.value,
  countryCode: countryCode.value,
  city: city.value,
  startMonth: startMonth.value,
  endMonth: endMonth.value,
  current: current.value
}))

const validate = () =>
  formErrors({
    school: requiredError(school.value, 'a school'),
    startMonth: monthError(startMonth.value, startPartial.value, true),
    endMonth: !current.value && monthError(endMonth.value, endPartial.value)
  })

const { run, loading } = useMutation(() => emit('changed'))

const bullets = useTemplateRef('bullets')

const submit = async () => {
  if (!(await bullets.value!.flush())) return
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
  <AppFormModal
    v-model:open="open"
    :title="education ? 'Edit education' : 'Add education'"
    :state="state"
    :validate="validate"
    :loading="loading"
    @submit="submit"
  >
    <div class="space-y-4">
      <UFormField label="School" name="school" required>
        <UInput v-model="school" class="w-full" data-testid="education-school" />
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
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Start" name="startMonth" required>
          <AppMonthField v-model="startMonth" v-model:partial="startPartial" />
        </UFormField>
        <UFormField label="End" name="endMonth">
          <div class="space-y-2">
            <AppMonthField v-model="endMonth" v-model:partial="endPartial" :disabled="current" />
            <UCheckbox v-model="current" label="Current" />
          </div>
        </UFormField>
      </div>
    </div>

    <template #after>
      <ProfileEntryBullets
        ref="bullets"
        kind="EDUCATION"
        :entry="education"
        class="mt-6 border-t border-default pt-4"
        @changed="emit('changed')"
      />
    </template>
  </AppFormModal>
</template>

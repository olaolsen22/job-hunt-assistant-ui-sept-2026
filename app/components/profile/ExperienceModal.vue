<script setup lang="ts">
import type { ProfileExperience } from '~/composables/useProfile'

// Without `experience` it adds one; with it, it edits that one and its bullets, which save on their own.
const { experience } = defineProps<{ experience: ProfileExperience | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const ADD_EXPERIENCE = graphql(`
  mutation AddProfileExperience($input: AddProfileExperienceInput!) {
    addProfileExperience(input: $input) {
      profileExperience {
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

const UPDATE_EXPERIENCE = graphql(`
  mutation UpdateProfileExperience($input: UpdateProfileExperienceInput!) {
    updateProfileExperience(input: $input) {
      profileExperience {
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

const employer = ref('')
const title = ref('')
const countryCode = ref<string>()
const city = ref<string>()
const startMonth = ref<string | null>(null)
const endMonth = ref<string | null>(null)
const current = ref(false)
const skills = ref<string[]>([])
const startPartial = ref(false)
const endPartial = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  employer.value = experience?.employer ?? ''
  title.value = experience?.title ?? ''
  countryCode.value = experience?.location?.countryCode
  city.value = experience?.location?.city ?? undefined
  startMonth.value = experience?.startMonth ?? null
  endMonth.value = experience?.endMonth ?? null
  current.value = !!experience && !experience.endMonth
  skills.value = experience?.skills.map((s) => s.name) ?? []
})

watch(current, (isCurrent) => {
  if (isCurrent) endMonth.value = null
})

const state = computed(() => ({
  employer: employer.value,
  title: title.value,
  countryCode: countryCode.value,
  city: city.value,
  startMonth: startMonth.value,
  endMonth: endMonth.value,
  current: current.value,
  skills: skills.value
}))

const validate = () =>
  formErrors({
    employer: requiredError(employer.value, 'an employer'),
    title: requiredError(title.value, 'a title'),
    startMonth: monthError(startMonth.value, startPartial.value, true),
    endMonth: !current.value && monthError(endMonth.value, endPartial.value)
  })

const { run, loading } = useMutation(() => emit('changed'))

const bullets = useTemplateRef('bullets')

const submit = async () => {
  if (!(await bullets.value!.flush())) return
  const fields = {
    employer: employer.value.trim(),
    title: title.value.trim(),
    location: locationInput(countryCode.value, city.value),
    startMonth: startMonth.value!,
    endMonth: current.value ? null : endMonth.value,
    skillNames: skills.value
  }
  const ok = await run(async () => {
    if (experience) {
      const { updateProfileExperience } = await gql(UPDATE_EXPERIENCE, {
        input: { id: experience.id, ...fields }
      })
      return updateProfileExperience.errors
    }
    const { addProfileExperience } = await gql(ADD_EXPERIENCE, { input: fields })
    return addProfileExperience.errors
  })
  if (!ok) return
  // A new skill is a new name, so the cached suggestions are stale.
  clearNuxtState('name-lookups')
  open.value = false
  emit('changed')
}
</script>

<template>
  <AppFormModal
    v-model:open="open"
    :title="experience ? 'Edit experience' : 'Add experience'"
    :state="state"
    :validate="validate"
    :loading="loading"
    @submit="submit"
  >
    <div class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Employer" name="employer" required>
          <UInput v-model="employer" class="w-full" data-testid="experience-employer" />
        </UFormField>
        <UFormField label="Title" name="title" required>
          <UInput v-model="title" class="w-full" data-testid="experience-title" />
        </UFormField>
      </div>
      <ProfileLocationField v-model:country-code="countryCode" v-model:city="city" />
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Start" name="startMonth" required>
          <AppMonthField
            v-model="startMonth"
            v-model:partial="startPartial"
            data-testid="experience-start"
          />
        </UFormField>
        <UFormField label="End" name="endMonth">
          <div class="space-y-2">
            <AppMonthField
              v-model="endMonth"
              v-model:partial="endPartial"
              :disabled="current"
              data-testid="experience-end"
            />
            <UCheckbox v-model="current" label="Current" data-testid="experience-current" />
          </div>
        </UFormField>
      </div>
      <UFormField label="Skills">
        <ProfileNamesField v-model="skills" lookup="skills" placeholder="Search or add a skill" />
      </UFormField>
    </div>

    <template #after>
      <ProfileEntryBullets
        ref="bullets"
        kind="EXPERIENCE"
        :entry="experience"
        class="mt-6 border-t border-default pt-4"
        @changed="emit('changed')"
      />
    </template>
  </AppFormModal>
</template>

<script setup lang="ts">
import type { ProfileExperience } from '~/composables/useProfile'

// Without `experience` it adds one; with it, it edits that one. Bullets are edited on the card.
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

const { run, loading } = useMutation(() => emit('changed'))

const submit = async () => {
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
  <AppConfirmModal
    v-model:open="open"
    :title="experience ? 'Edit experience' : 'Add experience'"
    confirm-label="Save"
    :loading="loading"
    :disabled="!employer.trim() || !title.trim() || !startMonth"
    @confirm="submit"
  >
    <div class="space-y-4">
      <UFormField label="Employer" required>
        <UInput v-model="employer" class="w-full" data-testid="experience-employer" />
      </UFormField>
      <UFormField label="Title" required>
        <UInput v-model="title" class="w-full" data-testid="experience-title" />
      </UFormField>
      <ProfileLocationField v-model:country-code="countryCode" v-model:city="city" />
      <UFormField label="Start" required>
        <AppMonthField v-model="startMonth" data-testid="experience-start" />
      </UFormField>
      <UFormField label="End">
        <div class="space-y-2">
          <AppMonthField v-model="endMonth" :disabled="current" />
          <UCheckbox v-model="current" label="Current" data-testid="experience-current" />
        </div>
      </UFormField>
      <UFormField label="Skills">
        <ProfileNamesField v-model="skills" lookup="skills" placeholder="Search or add a skill" />
      </UFormField>
    </div>
  </AppConfirmModal>
</template>

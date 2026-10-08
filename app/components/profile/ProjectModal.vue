<script setup lang="ts">
import type { ProfileProject } from '~/composables/useProfile'

// Without `project` it adds one; with it, it edits that one. Bullets are edited on the card.
const { project } = defineProps<{ project: ProfileProject | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const ADD_PROJECT = graphql(`
  mutation AddProfileProject($input: AddProfileProjectInput!) {
    addProfileProject(input: $input) {
      profileProject {
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

const UPDATE_PROJECT = graphql(`
  mutation UpdateProfileProject($input: UpdateProfileProjectInput!) {
    updateProfileProject(input: $input) {
      profileProject {
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

const name = ref('')
const url = ref('')
const countryCode = ref<string>()
const city = ref<string>()
const startMonth = ref<string | null>(null)
const endMonth = ref<string | null>(null)
const skills = ref<string[]>([])

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = project?.name ?? ''
  url.value = project?.url ?? ''
  countryCode.value = project?.location?.countryCode
  city.value = project?.location?.city ?? undefined
  startMonth.value = project?.startMonth ?? null
  endMonth.value = project?.endMonth ?? null
  skills.value = project?.skills.map((s) => s.name) ?? []
})

const { run, loading } = useMutation(() => emit('changed'))

const submit = async () => {
  const fields = {
    name: name.value.trim(),
    url: url.value.trim() || null,
    location: locationInput(countryCode.value, city.value),
    startMonth: startMonth.value,
    endMonth: endMonth.value,
    skillNames: skills.value
  }
  const ok = await run(async () => {
    if (project) {
      const { updateProfileProject } = await gql(UPDATE_PROJECT, {
        input: { id: project.id, ...fields }
      })
      return updateProfileProject.errors
    }
    const { addProfileProject } = await gql(ADD_PROJECT, { input: fields })
    return addProfileProject.errors
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
    :title="project ? 'Edit project' : 'Add project'"
    confirm-label="Save"
    :loading="loading"
    :disabled="!name.trim()"
    @confirm="submit"
  >
    <div class="space-y-4">
      <UFormField label="Name" required>
        <UInput v-model="name" class="w-full" />
      </UFormField>
      <UFormField label="URL">
        <UInput v-model="url" placeholder="https://" class="w-full" />
      </UFormField>
      <ProfileLocationField v-model:country-code="countryCode" v-model:city="city" />
      <UFormField label="Start">
        <AppMonthField v-model="startMonth" />
      </UFormField>
      <UFormField label="End">
        <AppMonthField v-model="endMonth" />
      </UFormField>
      <UFormField label="Skills">
        <ProfileNamesField v-model="skills" lookup="skills" placeholder="Search or add a skill" />
      </UFormField>
    </div>
  </AppConfirmModal>
</template>

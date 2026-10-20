<script setup lang="ts">
import type { ProfileProject } from '~/composables/useProfile'
import type { ProjectKind } from '~/constants/listing'

// Without `project` it adds one; with it, it edits that one. Its bullets save on their own.
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
const kind = ref<ProjectKind | null>(null)
const url = ref('')
const countryCode = ref<string>()
const city = ref<string>()
const startMonth = ref<string | null>(null)
const endMonth = ref<string | null>(null)
const skills = ref<string[]>([])
const startPartial = ref(false)
const endPartial = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = project?.name ?? ''
  kind.value = project?.kind ?? null
  url.value = project?.url ?? ''
  countryCode.value = project?.location?.countryCode
  city.value = project?.location?.city ?? undefined
  startMonth.value = project?.startMonth ?? null
  endMonth.value = project?.endMonth ?? null
  skills.value = project?.skills.map((s) => s.name) ?? []
})

const state = computed(() => ({
  name: name.value,
  kind: kind.value,
  url: url.value,
  countryCode: countryCode.value,
  city: city.value,
  startMonth: startMonth.value,
  endMonth: endMonth.value,
  skills: skills.value
}))

const validate = () =>
  formErrors({
    name: requiredError(name.value, 'a name'),
    startMonth: monthError(startMonth.value, startPartial.value),
    endMonth: monthError(endMonth.value, endPartial.value)
  })

const { run, loading } = useMutation(() => emit('changed'))

const bullets = useTemplateRef('bullets')

const submit = async () => {
  if (!(await bullets.value!.flush())) return
  const fields = {
    name: name.value.trim(),
    // Always sent: the update replaces the whole project, so leaving it out would clear it.
    kind: kind.value ?? null,
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
  <AppFormModal
    v-model:open="open"
    :title="project ? 'Edit project' : 'Add project'"
    :state="state"
    :validate="validate"
    :loading="loading"
    @submit="submit"
  >
    <div class="space-y-4">
      <UFormField label="Name" name="name" required>
        <UInput v-model="name" class="w-full" data-testid="project-name" />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Type">
          <ProfileProjectKindSelect v-model="kind" />
        </UFormField>
        <UFormField label="URL">
          <UInput v-model="url" placeholder="https://" class="w-full" />
        </UFormField>
      </div>
      <ProfileLocationField v-model:country-code="countryCode" v-model:city="city" />
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Start" name="startMonth">
          <AppMonthField v-model="startMonth" v-model:partial="startPartial" />
        </UFormField>
        <UFormField label="End" name="endMonth">
          <AppMonthField v-model="endMonth" v-model:partial="endPartial" />
        </UFormField>
      </div>
      <UFormField label="Skills">
        <ProfileNamesField v-model="skills" lookup="skills" placeholder="Search or add a skill" />
      </UFormField>
    </div>

    <template #after>
      <ProfileEntryBullets
        ref="bullets"
        kind="PROJECT"
        :entry="project"
        class="mt-6 border-t border-default pt-4"
        @changed="emit('changed')"
      />
    </template>
  </AppFormModal>
</template>

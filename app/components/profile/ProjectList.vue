<script setup lang="ts">
import type { ProfileProject } from '~/composables/useProfile'

const props = defineProps<{ projects: readonly ProfileProject[] }>()
const emit = defineEmits<{ changed: []; clear: [] }>()

const { locale } = useProfileTranslation()

const DELETE_PROJECT = graphql(`
  mutation DeleteProfileProject($input: DeleteProfileProjectInput!) {
    deleteProfileProject(input: $input) {
      id
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

const formOpen = ref(false)
// By id, so the open form shows the refetched entry (its bullets save while it is open).
const editingId = ref<number | null>(null)
const editing = computed(() => props.projects.find((e) => e.id === editingId.value) ?? null)
const deleting = ref<ProfileProject | null>(null)
const deleteOpen = computed({
  get: () => !!deleting.value,
  set: (value) => {
    if (!value) deleting.value = null
  }
})

const openForm = (entry: ProfileProject | null) => {
  editingId.value = entry?.id ?? null
  formOpen.value = true
}

const { run, loading } = useMutation(() => emit('changed'))

const remove = async () => {
  const id = deleting.value!.id
  const ok = await run(async () => {
    const { deleteProfileProject } = await gql(DELETE_PROJECT, { input: { id } })
    return deleteProfileProject.errors
  })
  deleting.value = null
  if (ok) emit('changed')
}
</script>

<template>
  <ProfileSection
    clearable
    title="Projects"
    icon="i-lucide-folder-git-2"
    testid="profile-projects"
    :empty="!projects.length"
    empty-message="No projects yet."
    add-label="Add project"
    @clear="emit('clear')"
    @add="openForm(null)"
  >
    <ul class="divide-y divide-default">
      <ProfileEntry
        v-for="e in projects"
        :key="e.id"
        kind="PROJECT"
        :entry-id="e.id"
        :title="e.name"
        :dates="
          [
            formatMonthRange(e.startMonth, e.endMonth, undefined, locale),
            e.location && formatLocation(e.location)
          ]
            .filter(Boolean)
            .join(' · ')
        "
        :bullets="e.bullets"
        @edit="openForm(e)"
        @delete="deleting = e"
        @changed="emit('changed')"
      >
        <p v-if="e.url" class="text-sm">
          <ULink :to="e.url" target="_blank" class="break-all text-primary">{{ e.url }}</ULink>
        </p>
        <div v-if="e.skills.length" class="mt-1 flex flex-wrap gap-1">
          <UBadge v-for="s in e.skills" :key="s.id" color="neutral" variant="subtle" size="sm">{{
            s.name
          }}</UBadge>
        </div>
      </ProfileEntry>
    </ul>
  </ProfileSection>

  <!-- Outside the section: its body isn't rendered while the section is empty. -->
  <ProfileProjectModal v-model:open="formOpen" :project="editing" @changed="emit('changed')" />
  <AppConfirmModal
    v-model:open="deleteOpen"
    title="Delete this project?"
    :description="deleting ? `${deleting.name}, with its bullets.` : undefined"
    confirm-label="Delete"
    :loading="loading"
    @confirm="remove"
  />
</template>

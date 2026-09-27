<script setup lang="ts">
import type { ListingDetail } from '~/composables/useListing'

const { listing } = defineProps<{ listing: ListingDetail }>()
const emit = defineEmits<{ changed: [] }>()

const DELETE_INTERVIEW = graphql(`
  mutation DeleteInterview($input: DeleteInterviewInput!) {
    deleteInterview(input: $input) {
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

type Interview = ListingDetail['interviews'][number]

const canAdd = computed(() => ['APPLIED', 'INTERVIEWING'].includes(listing.status))

// Rounds are numbered by position in the whole (chronological) list, so they stay stable
// when an interview moves from upcoming to past.
const rounds = computed(() => {
  const now = Date.now()
  const all = listing.interviews.map((interview, i) => ({ interview, round: i + 1 }))
  return {
    upcoming: all.filter((r) => new Date(r.interview.scheduledAt).getTime() >= now),
    past: all.filter((r) => new Date(r.interview.scheduledAt).getTime() < now)
  }
})

const selected = ref<Interview | null>(null)
const formOpen = ref(false)
const openForm = (interview: Interview | null) => {
  selected.value = interview
  formOpen.value = true
}

const deleteOpen = ref(false)
const confirmDelete = (interview: Interview) => {
  selected.value = interview
  deleteOpen.value = true
}

const { run, loading } = useMutation(() => emit('changed'))

const remove = async () => {
  const ok = await run(async () => {
    const { deleteInterview } = await gql(DELETE_INTERVIEW, {
      input: { id: selected.value!.id }
    })
    return deleteInterview.errors
  })
  deleteOpen.value = false
  if (ok) emit('changed')
}
</script>

<template>
  <div class="space-y-3" data-testid="interviews">
    <div class="flex items-center justify-between gap-2">
      <h3 class="font-medium text-highlighted">Interviews</h3>
      <UButton
        v-if="canAdd"
        size="sm"
        variant="subtle"
        icon="i-lucide-plus"
        data-testid="interview-add"
        @click="openForm(null)"
        >Add interview</UButton
      >
    </div>

    <p v-if="!listing.interviews.length" class="text-sm text-muted">No interviews yet.</p>

    <template v-for="(group, name) in rounds" :key="name">
      <div v-if="group.length" class="space-y-1">
        <p class="text-xs font-medium uppercase text-muted">{{ name }}</p>
        <div class="divide-y divide-default">
          <div
            v-for="{ interview, round } in group"
            :key="interview.id"
            class="flex items-start justify-between gap-2 py-2"
          >
            <div class="min-w-0 space-y-1">
              <p class="font-medium">
                Round {{ round
                }}<template v-if="interview.title"> · {{ interview.title }}</template>
              </p>
              <p class="text-sm text-muted">{{ formatDateTime(interview.scheduledAt) }}</p>
              <LazyAppMarkdownContent v-if="interview.notes" :source="interview.notes" />
            </div>
            <div class="flex shrink-0 gap-1">
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-pencil"
                aria-label="Edit interview"
                @click="openForm(interview)"
              />
              <UButton
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-trash-2"
                aria-label="Delete interview"
                @click="confirmDelete(interview)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>

  <ListingsInterviewModal
    v-model:open="formOpen"
    :listing-id="listing.id"
    :interview="selected"
    @changed="emit('changed')"
  />

  <AppConfirmModal
    v-model:open="deleteOpen"
    title="Delete interview?"
    :description="selected?.title ?? undefined"
    confirm-label="Delete"
    :loading="loading"
    @confirm="remove"
  />
</template>

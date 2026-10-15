<script setup lang="ts">
import type { ResultOf } from 'gql.tada'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { LANGUAGE_OPTIONS } from '~/constants/listing'

const WRITING_SAMPLES = graphql(`
  query WritingSamples {
    writingSamples(first: 50) {
      nodes {
        id
        title
        text
        language
        kind
        updatedAt
      }
    }
  }
`)

const DELETE_SAMPLE = graphql(`
  mutation DeleteWritingSample($input: DeleteWritingSampleInput!) {
    deleteWritingSample(input: $input) {
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

export type WritingSample = NonNullable<
  NonNullable<ResultOf<typeof WRITING_SAMPLES>['writingSamples']>['nodes']
>[number]

// The API's cap; it rejects a 21st sample, so Add hides before that.
const MAX_SAMPLES = 20

// Not part of the profile query: only cover letters read samples, and the profile page is the only
// place they're managed.
const { data, status, error, refresh } = useAsyncData(
  'writing-samples',
  () => gql(WRITING_SAMPLES).then((r) => r.writingSamples?.nodes ?? []),
  { server: false }
)
const samples = computed(() => data.value ?? [])

const formOpen = ref(false)
const editing = ref<WritingSample | null>(null)
const deleting = ref<WritingSample | null>(null)
const deleteOpen = computed({
  get: () => !!deleting.value,
  set: (value) => {
    if (!value) deleting.value = null
  }
})
const openForm = (sample: WritingSample | null) => {
  editing.value = sample
  formOpen.value = true
}

const { run, loading } = useMutation(() => refresh())
const remove = async () => {
  const id = deleting.value!.id
  const ok = await run(async () => {
    const { deleteWritingSample } = await gql(DELETE_SAMPLE, { input: { id } })
    return deleteWritingSample.errors
  })
  deleting.value = null
  if (ok) await refresh()
}

const languageLabel = (value: string) => LANGUAGE_OPTIONS.find((o) => o.value === value)?.label
</script>

<template>
  <AppCard v-if="error" title="Writing samples" data-testid="profile-writing-samples">
    <UAlert
      color="error"
      variant="subtle"
      :description="ERROR_MESSAGES.generic"
      :actions="[
        { label: 'Retry', color: 'neutral', variant: 'outline', onClick: () => refresh() }
      ]"
    />
  </AppCard>
  <AppCard
    v-else-if="status === 'idle' || status === 'pending'"
    title="Writing samples"
    data-testid="profile-writing-samples"
  >
    <USkeleton class="h-16 w-full" />
  </AppCard>
  <ProfileSection
    v-else
    :title="`Writing samples (${samples.length}/${MAX_SAMPLES})`"
    icon="i-lucide-file-pen-line"
    testid="profile-writing-samples"
    :empty="!samples.length"
    :full="samples.length >= MAX_SAMPLES"
    empty-message="Add past cover letters. Samples in the language you apply in teach the AI your style best."
    add-label="Add sample"
    @add="openForm(null)"
  >
    <p class="mb-3 text-sm text-muted">
      Past cover letters in the target language teach the AI your style best.
      <template v-if="samples.length >= MAX_SAMPLES">Limit reached ({{ MAX_SAMPLES }}).</template>
    </p>
    <ul class="divide-y divide-default">
      <li
        v-for="s in samples"
        :key="s.id"
        class="flex items-start gap-2 py-3 first:pt-0 last:pb-0"
        data-testid="profile-writing-sample"
      >
        <div class="min-w-0 flex-1 space-y-1">
          <p class="break-words font-medium text-highlighted">{{ s.title }}</p>
          <div class="flex flex-wrap gap-1.5">
            <UBadge color="neutral" variant="subtle" size="sm">{{
              languageLabel(s.language)
            }}</UBadge>
            <UBadge
              :color="s.kind === 'COVER_LETTER' ? 'primary' : 'neutral'"
              variant="subtle"
              size="sm"
              >{{ s.kind === 'COVER_LETTER' ? 'Cover letter' : 'Other' }}</UBadge
            >
          </div>
          <p class="line-clamp-2 break-words text-sm text-muted">{{ s.text }}</p>
        </div>
        <ProfileRowActions
          :name="s.title"
          testid="profile-writing-sample-actions"
          @edit="openForm(s)"
          @remove="deleting = s"
        />
      </li>
    </ul>
  </ProfileSection>

  <!-- Outside the section: its body isn't rendered while the section is empty. -->
  <ProfileWritingSampleModal v-model:open="formOpen" :sample="editing" @changed="refresh()" />
  <AppConfirmModal
    v-model:open="deleteOpen"
    title="Delete this writing sample?"
    :description="deleting ? `${deleting.title}.` : undefined"
    confirm-label="Delete"
    :loading="loading"
    @confirm="remove"
  />
</template>

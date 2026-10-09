<script setup lang="ts">
import { LANGUAGE_OPTIONS } from '~/constants/listing'
import type { ProfileData } from '~/composables/useProfile'

const props = defineProps<{ profile: ProfileData }>()
const emit = defineEmits<{ changed: [] }>()

const SET_TRANSLATION = graphql(`
  mutation SetProfileTranslation($input: SetProfileTranslationInput!) {
    setProfileTranslation(input: $input) {
      profileTranslation {
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

const DELETE_TRANSLATION = graphql(`
  mutation DeleteProfileTranslation($input: DeleteProfileTranslationInput!) {
    deleteProfileTranslation(input: $input) {
      language
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

const { target } = useProfileTranslation()
const targetLabel = computed(() => LANGUAGE_OPTIONS.find((o) => o.value === target.value)!.label)
const translation = computed(() =>
  props.profile.translations.find((t) => t.language === target.value)
)

const editOpen = ref(false)
const deleteOpen = ref(false)
const headline = ref('')
const summary = ref('')

const { run, loading } = useMutation(() => emit('changed'))

const startEdit = () => {
  headline.value = translation.value?.headline ?? ''
  summary.value = translation.value?.summary ?? ''
  editOpen.value = true
}

// The API replaces the whole row, so both fields are always sent (an empty one clears it).
const save = async () => {
  const ok = await run(async () => {
    const { setProfileTranslation } = await gql(SET_TRANSLATION, {
      input: {
        language: target.value,
        headline: headline.value.trim() || null,
        summary: summary.value.trim() || null,
        isMachine: false
      }
    })
    return setProfileTranslation.errors
  })
  if (!ok) return
  editOpen.value = false
  emit('changed')
}

const remove = async () => {
  const ok = await run(async () => {
    const { deleteProfileTranslation } = await gql(DELETE_TRANSLATION, {
      input: { language: target.value }
    })
    return deleteProfileTranslation.errors
  })
  if (!ok) return
  deleteOpen.value = false
  emit('changed')
}
</script>

<template>
  <div class="space-y-2 border-t border-default pt-3" data-testid="profile-translation">
    <div class="flex items-center gap-2">
      <UIcon name="i-lucide-languages" class="size-4 shrink-0 text-muted" />
      <h3 class="flex-1 font-medium text-highlighted">{{ targetLabel }} headline and summary</h3>
      <UBadge
        v-if="translation?.isMachine"
        color="neutral"
        variant="subtle"
        size="sm"
        data-testid="profile-translation-machine"
        >Machine</UBadge
      >
      <UButton
        :icon="translation ? 'i-lucide-pencil' : 'i-lucide-plus'"
        color="neutral"
        variant="subtle"
        size="sm"
        data-testid="profile-translation-edit"
        @click="startEdit"
        >{{ translation ? 'Edit' : 'Add translation' }}</UButton
      >
      <UButton
        v-if="translation"
        icon="i-lucide-trash-2"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="`Delete ${targetLabel} translation`"
        data-testid="profile-translation-delete"
        @click="deleteOpen = true"
      />
    </div>

    <template v-if="translation">
      <div data-testid="profile-translation-headline">
        <p v-if="translation.headline" class="text-muted">
          {{ translation.headline }}
          <UBadge
            v-if="translation.isHeadlineStale"
            color="warning"
            variant="subtle"
            size="sm"
            data-testid="profile-translation-headline-stale"
            >Stale</UBadge
          >
        </p>
        <!-- Previous original next to the current one, so the owner sees what changed. -->
        <div v-if="translation.isHeadlineStale" class="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span class="block text-xs text-muted">Previous original</span
            >{{ translation.sourceHeadline }}
          </p>
          <p>
            <span class="block text-xs text-muted">Current original</span>{{ profile.headline }}
          </p>
        </div>
      </div>
      <div data-testid="profile-translation-summary">
        <div v-if="translation.summary">
          <UBadge
            v-if="translation.isSummaryStale"
            color="warning"
            variant="subtle"
            size="sm"
            data-testid="profile-translation-summary-stale"
            >Stale</UBadge
          >
          <LazyAppMarkdownContent :source="translation.summary" />
        </div>
        <div v-if="translation.isSummaryStale" class="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <span class="block text-xs text-muted">Previous original</span>
            <LazyAppMarkdownContent
              v-if="translation.sourceSummary"
              :source="translation.sourceSummary"
            />
          </div>
          <div>
            <span class="block text-xs text-muted">Current original</span>
            <LazyAppMarkdownContent v-if="profile.summary" :source="profile.summary" />
          </div>
        </div>
      </div>
    </template>
    <p v-else class="text-sm text-muted" data-testid="profile-translation-empty">
      No {{ targetLabel }} translation yet.
    </p>

    <AppConfirmModal
      v-model:open="editOpen"
      :title="`${targetLabel} headline and summary`"
      confirm-label="Save"
      :loading="loading"
      @confirm="save"
    >
      <form class="space-y-4" @submit.prevent="save">
        <UFormField label="Headline" :hint="`${headline.length}/200`">
          <UInput
            v-model="headline"
            :maxlength="200"
            class="w-full"
            data-testid="profile-translation-headline-input"
          />
        </UFormField>
        <UFormField label="Summary" :hint="`${summary.length}/10000`">
          <UTextarea
            v-model="summary"
            :maxlength="10000"
            autoresize
            :rows="6"
            class="w-full"
            data-testid="profile-translation-summary-input"
          />
        </UFormField>
      </form>
    </AppConfirmModal>

    <AppConfirmModal
      v-model:open="deleteOpen"
      :title="`Delete the ${targetLabel} headline and summary?`"
      confirm-label="Delete"
      :loading="loading"
      @confirm="remove"
    />
  </div>
</template>

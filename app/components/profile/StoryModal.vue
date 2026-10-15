<script setup lang="ts">
import { PROFILE_FIELDS, type ProfileData } from '~/composables/useProfile'
import { STORY_FIELDS, STORY_MAX_LENGTH } from '~/constants/profileStory'

const { profile } = defineProps<{ profile: ProfileData }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [profile: ProfileData]; changed: [] }>()

const UPDATE_STORY = graphql(
  `
    mutation UpdateProfileStory($input: UpdateProfileStoryInput!) {
      updateProfileStory(input: $input) {
        profile {
          ...ProfileFields
        }
        errors {
          __typename
          ... on Error {
            message
          }
        }
      }
    }
  `,
  [PROFILE_FIELDS]
)

type StoryKey = (typeof STORY_FIELDS)[number]['key']
const story = ref({} as Record<StoryKey, string>)

watch(open, (isOpen) => {
  if (!isOpen) return
  story.value = Object.fromEntries(
    STORY_FIELDS.map((f) => [f.key, profile.story[f.key] ?? ''])
  ) as Record<StoryKey, string>
})

const { run, loading } = useMutation(() => emit('changed'))

// The API replaces the whole story, so all five parts go out; a blank one is cleared.
const submit = async () => {
  let saved: ProfileData | null = null
  const ok = await run(async () => {
    const input = Object.fromEntries(
      STORY_FIELDS.map((f) => [f.key, story.value[f.key].trim() || null])
    ) as Record<StoryKey, string | null>
    const { updateProfileStory } = await gql(UPDATE_STORY, { input })
    saved = updateProfileStory.profile
    return updateProfileStory.errors
  })
  if (!ok || !saved) return
  open.value = false
  emit('saved', saved)
}
</script>

<template>
  <AppFormModal
    v-model:open="open"
    title="Your story"
    description="Optional, and only cover letters use it. Write as much or as little as you like."
    save-label="Save story"
    :state="story"
    :loading="loading"
    @submit="submit"
  >
    <div class="space-y-4">
      <UFormField
        v-for="f in STORY_FIELDS"
        :key="f.key"
        :label="f.label"
        :help="f.hint"
        :name="f.key"
      >
        <UTextarea
          v-model="story[f.key]"
          :rows="2"
          :maxrows="8"
          :maxlength="STORY_MAX_LENGTH"
          autoresize
          class="w-full"
          :data-testid="`story-${f.key}`"
        />
        <template #hint>{{ story[f.key]?.length ?? 0 }}/{{ STORY_MAX_LENGTH }}</template>
      </UFormField>
    </div>
  </AppFormModal>
</template>

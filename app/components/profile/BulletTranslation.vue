<script setup lang="ts">
import { LANGUAGE_OPTIONS } from '~/constants/listing'
import type { ProfileBullet } from '~/composables/useProfile'

const props = defineProps<{ bullet: ProfileBullet }>()
const emit = defineEmits<{ changed: [] }>()

const SET_TRANSLATION = graphql(`
  mutation SetProfileBulletTranslation($input: SetProfileBulletTranslationInput!) {
    setProfileBulletTranslation(input: $input) {
      profileBulletTranslation {
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
  mutation DeleteProfileBulletTranslation($input: DeleteProfileBulletTranslationInput!) {
    deleteProfileBulletTranslation(input: $input) {
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

const { target } = useProfileTranslation()
const targetLabel = computed(() => LANGUAGE_OPTIONS.find((o) => o.value === target.value)!.label)
const translation = computed(() =>
  props.bullet.translations.find((t) => t.language === target.value)
)

const editing = ref(false)
const text = ref('')
const showChanges = ref(false)

const { run, loading } = useMutation(() => emit('changed'))

const startEdit = () => {
  text.value = translation.value?.text ?? ''
  editing.value = true
}

const save = async () => {
  const ok = await run(async () => {
    const { setProfileBulletTranslation } = await gql(SET_TRANSLATION, {
      // A manual save is never machine-made, so it clears the "machine" badge.
      input: {
        bulletId: props.bullet.id,
        language: target.value,
        text: text.value.trim(),
        isMachine: false
      }
    })
    return setProfileBulletTranslation.errors
  })
  if (!ok) return
  editing.value = false
  emit('changed')
}

const remove = async () => {
  const ok = await run(async () => {
    const { deleteProfileBulletTranslation } = await gql(DELETE_TRANSLATION, {
      input: { id: translation.value!.id }
    })
    return deleteProfileBulletTranslation.errors
  })
  if (ok) emit('changed')
}
</script>

<template>
  <div class="ml-7 mt-1 flex items-start gap-2" data-testid="profile-bullet-translation">
    <UIcon name="i-lucide-languages" class="mt-1 size-4 shrink-0 text-muted" />

    <form v-if="editing" class="min-w-0 flex-1 space-y-1" @submit.prevent="save">
      <UInput
        v-model="text"
        size="sm"
        :maxlength="500"
        :aria-label="`${targetLabel} translation of ${bullet.text}`"
        class="w-full"
        data-testid="profile-bullet-translation-input"
      />
      <div class="flex items-center gap-1">
        <UButton
          type="submit"
          size="xs"
          :loading="loading"
          :disabled="!text.trim()"
          data-testid="profile-bullet-translation-save"
          >Save</UButton
        >
        <UButton size="xs" color="neutral" variant="ghost" @click="editing = false">Cancel</UButton>
        <span class="ml-auto text-xs text-muted">{{ text.length }}/500</span>
      </div>
    </form>

    <div v-else-if="translation" class="min-w-0 flex-1">
      <div class="flex items-start gap-1">
        <span class="min-w-0 flex-1 break-words py-0.5 text-sm">{{ translation.text }}</span>
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="`Edit ${targetLabel} translation of ${bullet.text}`"
          data-testid="profile-bullet-translation-edit"
          @click="startEdit"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="`Delete ${targetLabel} translation of ${bullet.text}`"
          :disabled="loading"
          data-testid="profile-bullet-translation-delete"
          @click="remove"
        />
      </div>
      <div v-if="translation.isStale || translation.isMachine" class="flex flex-wrap gap-1">
        <UBadge
          v-if="translation.isStale"
          color="warning"
          variant="subtle"
          size="sm"
          data-testid="profile-bullet-translation-stale"
          >Stale</UBadge
        >
        <UBadge
          v-if="translation.isMachine"
          color="neutral"
          variant="subtle"
          size="sm"
          data-testid="profile-bullet-translation-machine"
          >Machine</UBadge
        >
        <UButton
          v-if="translation.isStale"
          size="xs"
          color="neutral"
          variant="link"
          data-testid="profile-bullet-translation-changes"
          @click="showChanges = !showChanges"
          >{{ showChanges ? 'Hide changes' : 'Show changes' }}</UButton
        >
      </div>
      <!-- The translation was written against the old original; show both so it's clear what changed. -->
      <div
        v-if="translation.isStale && showChanges"
        class="mt-1 grid gap-2 text-sm sm:grid-cols-2"
        data-testid="profile-bullet-translation-diff"
      >
        <p>
          <span class="block text-xs text-muted">Previous original</span
          >{{ translation.sourceText }}
        </p>
        <p><span class="block text-xs text-muted">Current original</span>{{ bullet.text }}</p>
      </div>
    </div>

    <UButton
      v-else
      size="xs"
      color="neutral"
      variant="ghost"
      icon="i-lucide-plus"
      :aria-label="`Add ${targetLabel} translation of ${bullet.text}`"
      data-testid="profile-bullet-translation-add"
      @click="startEdit"
      >Add {{ targetLabel }} translation</UButton
    >
  </div>
</template>

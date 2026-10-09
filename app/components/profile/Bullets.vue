<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import { BULLET_FIELDS, type ProfileBullet } from '~/composables/useProfile'

const props = defineProps<{
  kind: 'EXPERIENCE' | 'EDUCATION' | 'CERTIFICATION' | 'PROJECT'
  entryId: number
  bullets: readonly ProfileBullet[]
}>()
const emit = defineEmits<{ changed: [] }>()

const MAX_BULLETS = 20

const { translating } = useProfileTranslation()

const ADD_BULLET = graphql(`
  mutation AddProfileBullet($input: AddProfileBulletInput!) {
    addProfileBullet(input: $input) {
      profileBullet {
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

const UPDATE_BULLET = graphql(`
  mutation UpdateProfileBullet($input: UpdateProfileBulletInput!) {
    updateProfileBullet(input: $input) {
      profileBullet {
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

const MOVE_BULLET = graphql(
  `
    mutation MoveProfileBullet($input: MoveProfileBulletInput!) {
      moveProfileBullet(input: $input) {
        bullets {
          ...BulletFields
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
  [BULLET_FIELDS]
)

const DELETE_BULLET = graphql(`
  mutation DeleteProfileBullet($input: DeleteProfileBulletInput!) {
    deleteProfileBullet(input: $input) {
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

// A local copy for the drag list; a refetch (new prop) resets it.
const items = ref<ProfileBullet[]>([])
watch(
  () => props.bullets,
  (bullets) => (items.value = [...bullets]),
  { immediate: true }
)

const editingId = ref<number>()
const editText = ref('')
const newText = ref('')

const { run, loading } = useMutation(() => emit('changed'))

const add = async () => {
  const ok = await run(async () => {
    const { addProfileBullet } = await gql(ADD_BULLET, {
      input: { kind: props.kind, entryId: props.entryId, text: newText.value.trim() }
    })
    return addProfileBullet.errors
  })
  if (!ok) return
  newText.value = ''
  emit('changed')
}

const startEdit = (bullet: ProfileBullet) => {
  editingId.value = bullet.id
  editText.value = bullet.text
}

const saveEdit = async () => {
  const ok = await run(async () => {
    const { updateProfileBullet } = await gql(UPDATE_BULLET, {
      input: { id: editingId.value!, text: editText.value.trim() }
    })
    return updateProfileBullet.errors
  })
  if (!ok) return
  editingId.value = undefined
  emit('changed')
}

const remove = async (bullet: ProfileBullet) => {
  const ok = await run(async () => {
    const { deleteProfileBullet } = await gql(DELETE_BULLET, { input: { id: bullet.id } })
    return deleteProfileBullet.errors
  })
  if (ok) emit('changed')
}

// The drag list already shows the new order; the API's answer (the entry's whole list) replaces it.
// `oldIndex` is read from the props, which a drag doesn't touch.
const move = async ({ oldIndex, newIndex }: { oldIndex?: number; newIndex?: number }) => {
  const moved = props.bullets[oldIndex!]
  if (!moved || oldIndex === newIndex) return
  let reordered: ProfileBullet[] | null = null
  const ok = await run(async () => {
    const { moveProfileBullet } = await gql(MOVE_BULLET, {
      input: { id: moved.id, position: newIndex! }
    })
    reordered = moveProfileBullet.bullets
    return moveProfileBullet.errors
  })
  items.value = ok && reordered ? reordered : [...props.bullets]
}
</script>

<template>
  <div class="mt-2 space-y-1" data-testid="profile-bullets">
    <!-- Translating: the original is read-only, so no drag, edit or delete next to the translation. -->
    <ul v-if="translating" class="space-y-2">
      <li v-for="b in bullets" :key="b.id" data-testid="profile-bullet">
        <span class="block break-words text-sm">{{ b.text }}</span>
        <ProfileBulletTranslation :bullet="b" @changed="emit('changed')" />
      </li>
    </ul>

    <template v-else>
      <VueDraggable
        v-model="items"
        tag="ul"
        handle=".drag-handle"
        ghost-class="opacity-50"
        :animation="150"
        :disabled="loading || editingId !== undefined"
        class="space-y-1"
        @update="move"
      >
        <li
          v-for="b in items"
          :key="b.id"
          class="flex items-start gap-1"
          data-testid="profile-bullet"
        >
          <UButton
            icon="i-lucide-grip-vertical"
            color="neutral"
            variant="ghost"
            size="xs"
            :aria-label="`Drag ${b.text} to reorder`"
            class="drag-handle shrink-0 cursor-grab touch-none"
          />
          <form
            v-if="editingId === b.id"
            class="flex min-w-0 flex-1 items-center gap-1"
            @submit.prevent="saveEdit"
          >
            <UInput
              v-model="editText"
              size="sm"
              aria-label="Bullet text"
              class="min-w-0 flex-1"
              data-testid="profile-bullet-input"
            />
            <UButton
              type="submit"
              size="xs"
              :loading="loading"
              :disabled="!editText.trim()"
              data-testid="profile-bullet-save"
              >Save</UButton
            >
            <UButton size="xs" color="neutral" variant="ghost" @click="editingId = undefined"
              >Cancel</UButton
            >
          </form>
          <template v-else>
            <span class="min-w-0 flex-1 break-words py-0.5 text-sm">{{ b.text }}</span>
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="`Edit ${b.text}`"
              data-testid="profile-bullet-edit"
              @click="startEdit(b)"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="`Delete ${b.text}`"
              :disabled="loading"
              @click="remove(b)"
            />
          </template>
        </li>
      </VueDraggable>

      <form class="flex items-center gap-1" @submit.prevent="add">
        <UInput
          v-model="newText"
          size="sm"
          placeholder="Add a bullet"
          aria-label="New bullet"
          :disabled="items.length >= MAX_BULLETS"
          class="min-w-0 flex-1"
          data-testid="profile-bullet-new"
        />
        <UButton
          type="submit"
          icon="i-lucide-plus"
          size="sm"
          color="neutral"
          variant="subtle"
          :loading="loading"
          :disabled="items.length >= MAX_BULLETS || !newText.trim()"
          aria-label="Add bullet"
          data-testid="profile-bullet-add"
        />
      </form>
    </template>
  </div>
</template>

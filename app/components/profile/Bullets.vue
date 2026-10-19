<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import { BULLET_FIELDS, type ProfileBullet } from '~/composables/useProfile'

const props = defineProps<{
  kind: 'EXPERIENCE' | 'EDUCATION' | 'CERTIFICATION' | 'PROJECT'
  entryId: number
  bullets: readonly ProfileBullet[]
  // Inside the entry's form: drag, edit, delete and add. On the card the list is read-only.
  editable?: boolean
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
const deleting = ref<ProfileBullet | null>(null)
const deleteOpen = computed({
  get: () => !!deleting.value,
  set: (value) => {
    if (!value) deleting.value = null
  }
})

// One mutation per action, so deleting a bullet doesn't spin the Add button.
const { run: runAdd, loading: adding } = useMutation(() => emit('changed'))
const { run: runSave, loading: saving } = useMutation(() => emit('changed'))
const { run: runRemove, loading: removing } = useMutation(() => emit('changed'))
const { run: runMove, loading: moving } = useMutation(() => emit('changed'))
const busy = computed(() => adding.value || saving.value || removing.value || moving.value)

const add = async () => {
  if (!newText.value.trim() || items.value.length >= MAX_BULLETS || adding.value) return true
  const ok = await runAdd(async () => {
    const { addProfileBullet } = await gql(ADD_BULLET, {
      input: { kind: props.kind, entryId: props.entryId, text: newText.value.trim() }
    })
    return addProfileBullet.errors
  })
  if (!ok) return false
  newText.value = ''
  emit('changed')
  return true
}

const startEdit = (bullet: ProfileBullet) => {
  editingId.value = bullet.id
  editText.value = bullet.text
}

const saveEdit = async () => {
  if (!editText.value.trim() || saving.value) return true
  const ok = await runSave(async () => {
    const { updateProfileBullet } = await gql(UPDATE_BULLET, {
      input: { id: editingId.value!, text: editText.value.trim() }
    })
    return updateProfileBullet.errors
  })
  if (!ok) return false
  editingId.value = undefined
  emit('changed')
  return true
}

// The entry form's Save calls this first, so typed text isn't lost when the modal closes.
// False when a bullet failed to save; the form then stays open with the text still there.
const flush = async () => {
  if (editingId.value !== undefined && !(await saveEdit())) return false
  return add()
}
defineExpose({ flush })

const remove = async () => {
  const id = deleting.value!.id
  const ok = await runRemove(async () => {
    const { deleteProfileBullet } = await gql(DELETE_BULLET, { input: { id } })
    return deleteProfileBullet.errors
  })
  deleting.value = null
  if (ok) emit('changed')
}

// The drag list already shows the new order; the API's answer (the entry's whole list) replaces it
// until the refetch arrives.
// `oldIndex` is read from the props, which a drag doesn't touch.
const move = async ({ oldIndex, newIndex }: { oldIndex?: number; newIndex?: number }) => {
  const moved = props.bullets[oldIndex!]
  if (!moved || oldIndex === newIndex) return
  let reordered: ProfileBullet[] | null = null
  const ok = await runMove(async () => {
    const { moveProfileBullet } = await gql(MOVE_BULLET, {
      input: { id: moved.id, position: newIndex! }
    })
    reordered = moveProfileBullet.bullets
    return moveProfileBullet.errors
  })
  items.value = ok && reordered ? reordered : [...props.bullets]
  // The card behind the form shows the entry's bullets too.
  if (ok) emit('changed')
}
</script>

<template>
  <div v-if="editable" class="space-y-2" data-testid="profile-bullets">
    <div class="flex items-baseline justify-between gap-2">
      <h3 class="text-sm font-medium text-highlighted">Bullets</h3>
      <span class="text-xs text-muted">Bullets save as you edit, or with Save</span>
    </div>
    <VueDraggable
      v-model="items"
      tag="ul"
      handle=".drag-handle"
      ghost-class="opacity-50"
      :animation="150"
      :disabled="busy || editingId !== undefined"
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
          size="sm"
          :aria-label="`Drag ${b.text} to reorder`"
          class="drag-handle shrink-0 cursor-grab touch-none"
        />
        <!-- Not a <form>: Enter saves the bullet, and Escape cancels it without closing the modal. -->
        <div v-if="editingId === b.id" class="flex min-w-0 flex-1 items-center gap-1">
          <UInput
            v-model="editText"
            aria-label="Bullet text"
            class="min-w-0 flex-1"
            data-testid="profile-bullet-input"
            @keydown.enter.prevent="saveEdit"
            @keydown.esc.stop.prevent="editingId = undefined"
          />
          <UButton
            :loading="saving"
            :disabled="!editText.trim()"
            data-testid="profile-bullet-save"
            @click="saveEdit"
            >Save</UButton
          >
          <UButton color="neutral" variant="ghost" @click="editingId = undefined">Cancel</UButton>
        </div>
        <template v-else>
          <span class="min-w-0 flex-1 break-words py-1.5 text-sm">{{ b.text }}</span>
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="sm"
            :aria-label="`Edit ${b.text}`"
            data-testid="profile-bullet-edit"
            @click="startEdit(b)"
          />
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            size="sm"
            :aria-label="`Delete ${b.text}`"
            :disabled="busy"
            data-testid="profile-bullet-delete"
            @click="deleting = b"
          />
        </template>
      </li>
    </VueDraggable>

    <div class="flex items-center gap-1">
      <UInput
        v-model="newText"
        placeholder="Add a bullet"
        aria-label="New bullet"
        :disabled="items.length >= MAX_BULLETS"
        class="min-w-0 flex-1"
        data-testid="profile-bullet-new"
        @keydown.enter.prevent="add"
      />
      <!-- Label hidden on phones so the input keeps its width; aria-label covers it there. -->
      <UButton
        icon="i-lucide-plus"
        color="neutral"
        variant="subtle"
        :loading="adding"
        :disabled="items.length >= MAX_BULLETS || !newText.trim()"
        aria-label="Add bullet"
        data-testid="profile-bullet-add"
        @click="add"
        ><span class="hidden sm:inline">Add bullet</span></UButton
      >
    </div>

    <AppConfirmModal
      v-model:open="deleteOpen"
      title="Delete this bullet?"
      :description="deleting?.text"
      confirm-label="Delete"
      :loading="removing"
      @confirm="remove"
    />
  </div>

  <!-- On the card: plain text, or the read-only original beside its translation. -->
  <ul v-else-if="translating" class="mt-2 space-y-2" data-testid="profile-bullets">
    <li v-for="b in bullets" :key="b.id" data-testid="profile-bullet">
      <span class="block break-words text-sm">{{ b.text }}</span>
      <ProfileBulletTranslation :bullet="b" @changed="emit('changed')" />
    </li>
  </ul>
  <ul
    v-else-if="bullets.length"
    class="mt-2 list-disc space-y-1 ps-5 text-sm"
    data-testid="profile-bullets"
  >
    <li v-for="b in bullets" :key="b.id" class="break-words" data-testid="profile-bullet">
      {{ b.text }}
    </li>
  </ul>
</template>

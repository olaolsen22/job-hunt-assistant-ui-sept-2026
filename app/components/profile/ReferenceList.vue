<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import type { ProfileReference } from '~/composables/useProfile'

const props = withDefaults(
  defineProps<{
    references: readonly ProfileReference[]
    count?: number
  }>(),
  { count: undefined }
)
const emit = defineEmits<{ changed: []; clear: [] }>()

// Read only in the translated view (see ProfileSection).
const { translating } = useProfileTranslation()

const MOVE_REFERENCE = graphql(`
  mutation MoveProfileReference($input: MoveProfileReferenceInput!) {
    moveProfileReference(input: $input) {
      references {
        id
        name
        relationship
        company
        email
        phone
        note
        position
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

const DELETE_REFERENCE = graphql(`
  mutation DeleteProfileReference($input: DeleteProfileReferenceInput!) {
    deleteProfileReference(input: $input) {
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
const items = ref<ProfileReference[]>([])
watch(
  () => props.references,
  (references) => (items.value = [...references]),
  { immediate: true }
)

const formOpen = ref(false)
const editing = ref<ProfileReference | null>(null)
const deleting = ref<ProfileReference | null>(null)
const deleteOpen = computed({
  get: () => !!deleting.value,
  set: (value) => {
    if (!value) deleting.value = null
  }
})

const openForm = (reference: ProfileReference | null) => {
  editing.value = reference
  formOpen.value = true
}

const { run, loading } = useMutation(() => emit('changed'))

// The drag list already shows the new order; the API's answer (the whole list) replaces it.
// `oldIndex` is read from the props, which a drag doesn't touch.
const move = async ({ oldIndex, newIndex }: { oldIndex?: number; newIndex?: number }) => {
  const moved = props.references[oldIndex!]
  if (!moved || oldIndex === newIndex) return
  let reordered: ProfileReference[] | null = null
  const ok = await run(async () => {
    const { moveProfileReference } = await gql(MOVE_REFERENCE, {
      input: { id: moved.id, position: newIndex! }
    })
    reordered = moveProfileReference.references
    return moveProfileReference.errors
  })
  items.value = ok && reordered ? reordered : [...props.references]
}

const remove = async () => {
  const id = deleting.value!.id
  const ok = await run(async () => {
    const { deleteProfileReference } = await gql(DELETE_REFERENCE, { input: { id } })
    return deleteProfileReference.errors
  })
  deleting.value = null
  if (ok) emit('changed')
}
</script>

<template>
  <ProfileSection
    clearable
    title="References"
    icon="i-lucide-users"
    testid="profile-references"
    :empty="!references.length"
    :count="count"
    empty-message="No references yet."
    add-label="Add reference"
    @clear="emit('clear')"
    @add="openForm(null)"
  >
    <VueDraggable
      v-model="items"
      tag="ul"
      handle=".drag-handle"
      ghost-class="opacity-50"
      :animation="150"
      :disabled="loading || translating"
      class="divide-y divide-default"
      @update="move"
    >
      <li
        v-for="r in items"
        :key="r.id"
        class="flex items-start gap-2 py-3 first:pt-0 last:pb-0"
        data-testid="profile-reference"
      >
        <UButton
          v-if="!translating"
          icon="i-lucide-grip-vertical"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="`Drag ${r.name} to reorder`"
          class="drag-handle shrink-0 cursor-grab touch-none"
        />
        <div class="min-w-0 flex-1">
          <p class="break-words font-medium text-highlighted">{{ r.name }}</p>
          <p class="break-words text-sm">
            {{ [r.relationship, r.company].filter(Boolean).join(' · ') }}
          </p>
          <p v-if="r.email || r.phone" class="break-all text-sm text-muted">
            {{ [r.email, r.phone].filter(Boolean).join(' · ') }}
          </p>
          <p v-if="r.note" class="mt-1 whitespace-pre-line break-words text-sm text-muted">
            {{ r.note }}
          </p>
        </div>
        <ProfileRowActions
          v-if="!translating"
          :name="r.name"
          testid="profile-reference-actions"
          @edit="openForm(r)"
          @remove="deleting = r"
        />
      </li>
    </VueDraggable>
  </ProfileSection>

  <!-- Outside the section: its body isn't rendered while the section is empty. -->
  <ProfileReferenceModal v-model:open="formOpen" :reference="editing" @changed="emit('changed')" />
  <AppConfirmModal
    v-model:open="deleteOpen"
    title="Delete this reference?"
    :description="deleting ? `${deleting.name}.` : undefined"
    confirm-label="Delete"
    :loading="loading"
    @confirm="remove"
  />
</template>

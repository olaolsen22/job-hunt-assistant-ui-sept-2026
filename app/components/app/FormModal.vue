<script setup lang="ts" generic="T extends object">
import type { FormError, FormErrorEvent } from '@nuxt/ui'
import { PHONE_FULLSCREEN_MODAL } from '~/constants/ui'

// A form in a modal: Enter or Save submits through UForm, so `validate` errors show inline beside
// their fields. Closing with changes to `state` since it opened asks before discarding them.
const props = defineProps<{
  title: string
  description?: string
  saveLabel?: string
  loading?: boolean
  state: T
  validate?: (state: Partial<T>) => FormError[]
  // Changes kept outside `state` that closing would also lose (an entry form's typed bullet).
  unsaved?: boolean
  // Wider on tablet and desktop, for a form laid out as a table (the tailored CV's skills).
  wide?: boolean
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ submit: [] }>()

const id = useId()

// Post flush: the parent resets its fields in its own watch(open), and the new state reaches this
// prop only after the parent re-renders.
const snapshot = ref('')
watch(
  open,
  (isOpen) => {
    if (isOpen) snapshot.value = JSON.stringify(props.state)
  },
  { flush: 'post', immediate: true }
)
const dirty = computed(() => props.unsaved || JSON.stringify(props.state) !== snapshot.value)

const discardOpen = ref(false)
const modalOpen = computed({
  get: () => open.value,
  set: (value: boolean) => {
    if (value || props.loading) return
    if (dirty.value) discardOpen.value = true
    else open.value = false
  }
})
const discard = () => {
  discardOpen.value = false
  open.value = false
}

const focusFirstError = (event: FormErrorEvent) => {
  const first = event.errors[0]?.id
  if (first) document.getElementById(first)?.focus()
}

// For forms that save without closing (a draft step): validate shows the inline errors the way
// Save does, and markClean stops closing afterwards from asking to discard what was just saved.
const form = useTemplateRef('form')
defineExpose({
  validate: async () => {
    const ok = await form.value?.validate({ silent: true })
    if (!ok) focusFirstError({ errors: form.value?.getErrors() ?? [] } as FormErrorEvent)
    return !!ok
  },
  markClean: () => (snapshot.value = JSON.stringify(props.state))
})
</script>

<template>
  <UModal
    v-model:open="modalOpen"
    :title="title"
    :description="description"
    :dismissible="!loading"
    :ui="{ content: [PHONE_FULLSCREEN_MODAL, wide && 'sm:max-w-3xl'] }"
  >
    <template #body>
      <UForm
        :id="id"
        ref="form"
        :state="state"
        :validate="validate"
        :validate-on="['input']"
        @submit="emit('submit')"
        @error="focusFirstError"
      >
        <slot />
      </UForm>
      <!-- Content that saves on its own (bullets), outside the form so Enter there doesn't submit it. -->
      <slot name="after" />
    </template>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="loading"
          data-testid="form-modal-cancel"
          @click="modalOpen = false"
          >Cancel</UButton
        >
        <UButton type="submit" :form="id" :loading="loading" data-testid="form-modal-save">{{
          saveLabel ?? 'Save'
        }}</UButton>
      </div>
    </template>
  </UModal>

  <AppConfirmModal
    v-model:open="discardOpen"
    title="Discard changes?"
    description="Your unsaved changes will be lost."
    confirm-label="Discard"
    @confirm="discard"
  />
</template>

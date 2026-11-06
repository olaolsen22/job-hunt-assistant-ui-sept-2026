<script setup lang="ts">
// Deletes a CV template. Once a version was used for an application the API keeps it for the
// record and only allows archiving, so the same dialog then offers that instead.
const { baseCv } = defineProps<{ baseCv: { id: number; name: string } }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ deleted: []; archived: [] }>()

const { remove, deleting, setArchived, archiving } = useBaseCvActions()
const inUse = ref(false)
watch(open, (isOpen) => {
  if (isOpen) inUse.value = false
})

// Emits before closing: the parent may drop its target when the dialog closes.
const confirm = async () => {
  if (inUse.value) {
    if (!(await setArchived(baseCv.id, true))) return
    emit('archived')
    open.value = false
    return
  }
  const outcome = await remove(baseCv.id)
  if (outcome === 'in-use') inUse.value = true
  else if (outcome === 'deleted') {
    emit('deleted')
    open.value = false
  }
}
</script>

<template>
  <AppConfirmModal
    v-model:open="open"
    :title="inUse ? `Archive ${baseCv.name} instead?` : `Delete ${baseCv.name}?`"
    :description="
      inUse
        ? 'It was used for an application, so it is kept for the record. Archiving hides it from the Apply dialog; you can restore it later.'
        : 'The template and all its versions, in every language, are deleted.'
    "
    :confirm-label="inUse ? 'Archive' : 'Delete'"
    :color="inUse ? 'primary' : 'error'"
    :loading="deleting || archiving"
    @confirm="confirm"
  />
</template>

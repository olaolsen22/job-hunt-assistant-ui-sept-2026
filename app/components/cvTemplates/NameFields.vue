<script setup lang="ts">
// A template's name and description, shared by the create page and Edit details. A taken name shows
// on the field with a link to the template that has it; `focus()` moves there after that error.
const name = defineModel<string>('name', { required: true })
const description = defineModel<string>('description', { required: true })
defineProps<{ error?: string; existingId?: number }>()

const nameInput = useTemplateRef('nameInput')
defineExpose({ focus: () => nameInput.value?.inputRef?.focus() })
</script>

<template>
  <div class="space-y-4">
    <UFormField label="Name" name="name" required :error="error">
      <UInput
        ref="nameInput"
        v-model="name"
        placeholder="Frontend"
        class="w-full"
        data-testid="cv-template-name"
      />
    </UFormField>
    <!-- Outside the field: its help slot is hidden while the error shows. -->
    <ULink
      v-if="existingId"
      :to="`/cv-templates/${existingId}`"
      class="-mt-2 block text-sm text-primary"
      data-testid="cv-template-existing"
      >Open the existing template</ULink
    >
    <UFormField label="Description" name="description">
      <UTextarea
        v-model="description"
        :rows="2"
        autoresize
        placeholder="Which roles it's for"
        class="w-full"
        data-testid="cv-template-description"
      />
    </UFormField>
  </div>
</template>

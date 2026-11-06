<script setup lang="ts">
defineEmits<{ discard: [] }>()
</script>

<template>
  <UAlert
    color="warning"
    variant="subtle"
    icon="i-lucide-sparkles"
    title="AI draft loaded. Check your bullets before saving."
    description="A bullet whose wording doesn’t match your profile goes back to your original text without notice. Combined bullets are the most likely to change. Nothing is saved until you save."
    :actions="[
      {
        label: 'Discard',
        color: 'neutral',
        variant: 'ghost',
        onClick: () => $emit('discard')
      }
    ]"
    data-testid="cv-template-ai-draft"
  />
</template>

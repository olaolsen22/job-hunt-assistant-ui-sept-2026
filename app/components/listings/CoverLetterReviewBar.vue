<script setup lang="ts">
// The cover letter's sticky bar while a new letter waits: the two ways out. Saving waits until it's
// gone, like the tailored CV's review bar. The card's badge says where the letter came from.
const emit = defineEmits<{ use: []; discard: [] }>()
</script>

<template>
  <AppSaveBar
    status="Not used yet · your letter is unchanged"
    status-testid="cover-letter-review-status"
    changed
    :warn="false"
    data-testid="cover-letter-review-bar"
  >
    <UButton
      icon="i-lucide-x"
      color="neutral"
      variant="outline"
      class="w-full justify-center sm:w-auto"
      data-testid="cover-letter-review-discard"
      @click="emit('discard')"
      >Discard</UButton
    >
    <UButton
      icon="i-lucide-check"
      class="w-full justify-center sm:w-auto"
      data-testid="cover-letter-review-use"
      @click="emit('use')"
      >Use new letter</UButton
    >
  </AppSaveBar>
</template>

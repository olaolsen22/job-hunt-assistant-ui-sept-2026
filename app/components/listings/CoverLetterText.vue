<script setup lang="ts">
import type { CoverLetter } from '~/utils/coverLetter'

// A letter's text as the reader reads it (subject, greeting, paragraphs, closing and the name),
// read only: both sides of a new letter's review. `name` signs it instead of the letter's own, since
// a new letter keeps the editor's details when used.
const { letter, name = undefined } = defineProps<{ letter: CoverLetter; name?: string }>()
const signature = computed(() =>
  [letter.closing, name ?? letter.fullName].filter((l) => l.trim()).join('\n')
)
</script>

<template>
  <div class="space-y-3 text-sm/6 break-words" data-testid="cover-letter-text">
    <p v-if="letter.subject.trim()" class="font-semibold text-highlighted">{{ letter.subject }}</p>
    <p v-if="letter.greeting.trim()">{{ letter.greeting }}</p>
    <p
      v-for="(paragraph, i) in letter.paragraphs.filter((p) => p.trim())"
      :key="i"
      class="whitespace-pre-line"
    >
      {{ paragraph }}
    </p>
    <p v-if="signature" class="whitespace-pre-line">{{ signature }}</p>
  </div>
</template>

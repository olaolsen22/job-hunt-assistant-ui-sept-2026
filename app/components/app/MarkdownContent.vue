<script setup lang="ts">
import DOMPurify from 'dompurify'
import { marked } from 'marked'

const { source } = defineProps<{ source: string }>()

// The API stores notes as-is, so sanitize before v-html.
const html = computed(() => DOMPurify.sanitize(marked.parse(source, { async: false })))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="prose prose-sm max-w-none dark:prose-invert" v-html="html" />
</template>

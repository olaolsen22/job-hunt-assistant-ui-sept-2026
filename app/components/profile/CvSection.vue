<script setup lang="ts">
import { CV_ISSUES, cvPathWithin } from '~/utils/profileCvImport'

// A CV review section whose heading counts the issues under `path`, so long reviews stay scannable.
const props = defineProps<{ title: string; icon: string; path: string }>()
const issues = inject(CV_ISSUES)!
const count = computed(
  () => issues.value.filter((issue) => cvPathWithin(issue.path, props.path)).length
)
</script>

<template>
  <section class="space-y-3" :data-testid="`cv-section-${path}`">
    <div class="flex flex-wrap items-center gap-2">
      <UIcon :name="icon" class="size-5 text-muted" />
      <h3 class="font-semibold text-highlighted">{{ title }}</h3>
      <UBadge v-if="count" color="warning" variant="subtle" size="sm">{{ count }} to check</UBadge>
      <div class="ms-auto flex gap-2"><slot name="actions" /></div>
    </div>
    <slot />
  </section>
</template>

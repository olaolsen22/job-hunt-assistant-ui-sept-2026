<script setup lang="ts">
import { CV_ISSUES, cvPathWithin } from '~/utils/profileCvImport'

// One review issue beside its control. Without a slot it is a message-only target for an item or
// section; `exact` keeps those from also claiming their fields' issues.
const props = defineProps<{ path: string; label?: string; help?: string; exact?: boolean }>()
const slots = defineSlots<{ default?: () => unknown }>()
const issues = inject(CV_ISSUES)!
const matching = computed(() =>
  issues.value.filter((issue) =>
    props.exact ? issue.path === props.path : cvPathWithin(issue.path, props.path)
  )
)
const error = computed(() => matching.value.find((issue) => !issue.severity)?.message)
const warning = computed(() => (error.value ? undefined : matching.value[0]?.message))
</script>

<template>
  <!-- tabindex: focus can land on a message-only target, which has no control of its own. -->
  <div
    v-if="slots.default || matching.length"
    :data-cv-field="path"
    tabindex="-1"
    class="focus:outline-none"
  >
    <UFormField :label="label" :help="help" :error="error">
      <slot />
      <p v-if="warning" class="mt-1 text-sm text-warning" data-testid="cv-field-warning">
        {{ warning }}
      </p>
    </UFormField>
  </div>
</template>

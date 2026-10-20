<script setup lang="ts">
import { PROJECT_KIND_OPTIONS, type ProjectKind } from '~/constants/listing'

// Optional project type for the profile and tailored CV forms. USelectMenu because USelect can't go
// back to empty once a value is picked; `clear` adds the button that does.
const kind = defineModel<ProjectKind | null | undefined>({ required: true })
</script>

<template>
  <USelectMenu
    :model-value="kind ?? undefined"
    :items="[...PROJECT_KIND_OPTIONS]"
    value-key="value"
    :search-input="false"
    clear
    placeholder="Not specified"
    class="w-full"
    data-testid="project-kind"
    @update:model-value="kind = $event ?? null"
  />
</template>

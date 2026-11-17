<script setup lang="ts">
import type { TailoredCv } from '~/utils/tailoredCv'
import { CV_APPLY_DESCRIPTION } from '~/constants/listing'

// The tailored CV's skills, edited on a copy (order, removal, Developer categories and groups);
// Apply puts them back into the page's draft, so the Skills card itself stays a plain list.
type Skills = TailoredCv['skills']
const props = defineProps<{ skills: Skills; sectionOrder: TailoredCv['sectionOrder'] }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ apply: [skills: Skills] }>()

const copy = (skills: Skills): Skills => skills.map((s) => ({ ...s }))
const draft = ref(copy(props.skills))
watch(open, (isOpen) => {
  if (isOpen) draft.value = copy(props.skills)
})

const apply = () => {
  emit('apply', draft.value)
  open.value = false
}
</script>

<template>
  <AppFormModal
    v-model:open="open"
    title="Edit skills"
    :description="CV_APPLY_DESCRIPTION"
    save-label="Apply"
    :state="{ skills: draft }"
    @submit="apply"
  >
    <div class="space-y-3" data-testid="tailored-cv-skills-modal">
      <p v-if="!draft.length" class="text-sm text-muted">No skills in this CV.</p>
      <CvSkillRows
        v-model:skills="draft"
        :section-order="sectionOrder"
        @remove="(i) => draft.splice(i, 1)"
      />
      <p class="text-xs text-muted">
        {{
          sectionOrder === 'DEVELOPER'
            ? 'A group replaces the category in the PDF, and skills with the same group share a line.'
            : 'Categories and groups show with the Developer PDF layout.'
        }}
        Changes apply to this CV only.
      </p>
    </div>
  </AppFormModal>
</template>

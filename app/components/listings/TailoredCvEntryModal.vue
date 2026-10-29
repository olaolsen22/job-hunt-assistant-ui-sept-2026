<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import type {
  CvEntry,
  CvEntryList,
  TailoredCv,
  TailoredCvBullet,
  TailoredCvCertification,
  TailoredCvEducation,
  TailoredCvExperience,
  TailoredCvProject
} from '~/utils/tailoredCv'
import { CV_APPLY_DESCRIPTION } from '~/constants/listing'

// Edits one tailored CV entry on a copy; Apply puts it back into the page's draft, which the page's
// Save draft persists. AI, Remove and suggestions stay on the page.
const props = defineProps<{
  list: CvEntryList
  entry: CvEntry
  contentStyle: 'BULLETS' | 'PARAGRAPH'
  sectionOrder: TailoredCv['sectionOrder']
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ apply: [entry: CvEntry] }>()

const TITLES: Record<CvEntryList, string> = {
  experiences: 'Edit experience',
  educations: 'Edit education',
  certifications: 'Edit certification',
  projects: 'Edit project'
}

// Text inputs need strings, so these empty fields are '' while editing and as they were on Apply.
const BLANKABLE = {
  experiences: ['location', 'paragraph'],
  educations: ['degree', 'field', 'location', 'paragraph'],
  certifications: ['issuer', 'url', 'paragraph'],
  projects: ['url', 'location', 'paragraph']
} as const satisfies Record<CvEntryList, string[]>
type Draft<T, L extends CvEntryList> = Omit<T, (typeof BLANKABLE)[L][number]> &
  Record<(typeof BLANKABLE)[L][number], string>

// JSON copies, like the page's dirty check: the draft is plain data.
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
const draft = ref<Record<string, unknown>>({})
watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    const value = copy(props.entry) as Record<string, unknown>
    for (const key of BLANKABLE[props.list]) value[key] ??= ''
    draft.value = value
  },
  { immediate: true }
)

// One typed view per list, so each field block binds without casts in the template.
const experience = computed(() =>
  props.list === 'experiences'
    ? (draft.value as Draft<TailoredCvExperience, 'experiences'>)
    : undefined
)
const education = computed(() =>
  props.list === 'educations'
    ? (draft.value as Draft<TailoredCvEducation, 'educations'>)
    : undefined
)
const certification = computed(() =>
  props.list === 'certifications'
    ? (draft.value as Draft<TailoredCvCertification, 'certifications'>)
    : undefined
)
const project = computed(() =>
  props.list === 'projects' ? (draft.value as Draft<TailoredCvProject, 'projects'>) : undefined
)
const body = computed(() => draft.value as { bullets: TailoredCvBullet[]; paragraph: string })

// New bullets have no source id, and an index key would hand a dragged row's textarea to its
// neighbour; each bullet object gets its own key instead.
const bulletKeys = new WeakMap<TailoredCvBullet, number>()
let nextKey = 0
const bulletKey = (bullet: TailoredCvBullet) => {
  if (!bulletKeys.has(bullet)) bulletKeys.set(bullet, nextKey++)
  return bulletKeys.get(bullet)!
}

// Technologies only print in the developer layout, so the hint follows the chosen one.
const technologiesHint = computed(() =>
  props.sectionOrder === 'DEVELOPER'
    ? 'Printed under this entry in the PDF.'
    : 'Only printed with the Developer PDF layout.'
)

// An unchanged Apply leaves the draft as it was, so the page doesn't turn unsaved.
const apply = () => {
  const entry = copy(draft.value)
  const original = props.entry as Record<string, unknown>
  for (const key of BLANKABLE[props.list])
    if (entry[key] === '' && original[key] == null) entry[key] = original[key]
  if (JSON.stringify(entry) !== JSON.stringify(original)) emit('apply', entry as CvEntry)
  open.value = false
}
</script>

<template>
  <AppFormModal
    v-model:open="open"
    :title="TITLES[list]"
    :description="CV_APPLY_DESCRIPTION"
    save-label="Apply"
    :state="draft"
    @submit="apply"
  >
    <div class="space-y-4" data-testid="tailored-cv-entry-modal">
      <div class="grid gap-4 sm:grid-cols-2">
        <template v-if="experience">
          <UFormField label="Title"
            ><UInput v-model="experience.title" class="w-full"
          /></UFormField>
          <UFormField label="Employer"
            ><UInput v-model="experience.employer" class="w-full"
          /></UFormField>
          <UFormField label="Location" class="sm:col-span-2"
            ><UInput v-model="experience.location" class="w-full"
          /></UFormField>
          <UFormField label="Start"><AppMonthField v-model="experience.startMonth" /></UFormField>
          <UFormField label="End" help="Empty means present."
            ><AppMonthField v-model="experience.endMonth"
          /></UFormField>
          <UFormField label="Technologies" :help="technologiesHint" class="sm:col-span-2"
            ><ProfileNamesField
              v-model="experience.technologies"
              lookup="skills"
              placeholder="Add a technology"
          /></UFormField>
        </template>

        <template v-else-if="education">
          <UFormField label="School"
            ><UInput v-model="education.school" class="w-full"
          /></UFormField>
          <UFormField label="Degree"
            ><UInput v-model="education.degree" class="w-full"
          /></UFormField>
          <UFormField label="Field" class="sm:col-span-2"
            ><UInput v-model="education.field" class="w-full"
          /></UFormField>
          <UFormField label="Location" class="sm:col-span-2"
            ><UInput v-model="education.location" class="w-full"
          /></UFormField>
          <UFormField label="Start"><AppMonthField v-model="education.startMonth" /></UFormField>
          <UFormField label="End" help="Empty means ongoing."
            ><AppMonthField v-model="education.endMonth"
          /></UFormField>
        </template>

        <template v-else-if="certification">
          <UFormField label="Name"
            ><UInput v-model="certification.name" class="w-full"
          /></UFormField>
          <UFormField label="Issuer"
            ><UInput v-model="certification.issuer" class="w-full"
          /></UFormField>
          <UFormField label="Issued"
            ><AppMonthField v-model="certification.issuedMonth"
          /></UFormField>
          <UFormField label="Expires"
            ><AppMonthField v-model="certification.expiresMonth"
          /></UFormField>
          <UFormField label="URL" class="sm:col-span-2"
            ><UInput v-model="certification.url" type="url" class="w-full"
          /></UFormField>
        </template>

        <template v-else-if="project">
          <UFormField label="Name" class="sm:col-span-2"
            ><UInput v-model="project.name" class="w-full"
          /></UFormField>
          <UFormField label="Type"><ProfileProjectKindSelect v-model="project.kind" /></UFormField>
          <UFormField label="URL"
            ><UInput v-model="project.url" type="url" class="w-full"
          /></UFormField>
          <UFormField label="Location" class="sm:col-span-2"
            ><UInput v-model="project.location" class="w-full"
          /></UFormField>
          <UFormField label="Start"><AppMonthField v-model="project.startMonth" /></UFormField>
          <UFormField label="End" help="Empty means ongoing."
            ><AppMonthField v-model="project.endMonth"
          /></UFormField>
          <UFormField label="Technologies" :help="technologiesHint" class="sm:col-span-2"
            ><ProfileNamesField
              v-model="project.technologies"
              lookup="skills"
              placeholder="Add a technology"
          /></UFormField>
        </template>
      </div>

      <UFormField v-if="contentStyle === 'PARAGRAPH'" label="Paragraph">
        <UTextarea
          v-model="body.paragraph"
          :rows="4"
          autoresize
          class="w-full"
          placeholder="Summarize the relevant experience, or tailor it with AI."
          data-testid="tailored-cv-entry-paragraph-input"
        />
      </UFormField>
      <fieldset v-else class="space-y-2">
        <legend class="mb-2 text-sm font-medium">Bullets</legend>
        <VueDraggable
          v-model="body.bullets"
          handle=".drag-handle"
          ghost-class="opacity-50"
          :animation="150"
          class="space-y-2"
          data-testid="tailored-cv-entry-bullets"
        >
          <div
            v-for="(bullet, i) in body.bullets"
            :key="bulletKey(bullet)"
            class="flex items-start gap-1"
          >
            <UButton
              icon="i-lucide-grip-vertical"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="`Drag bullet ${i + 1} to reorder`"
              class="drag-handle shrink-0 cursor-grab touch-none"
            />
            <UTextarea
              v-model="bullet.text"
              :rows="1"
              autoresize
              class="flex-1"
              :aria-label="`Bullet ${i + 1}`"
            />
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="`Remove bullet ${i + 1}`"
              @click="body.bullets.splice(i, 1)"
            />
          </div>
        </VueDraggable>
        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="subtle"
          size="sm"
          @click="body.bullets.push({ text: '', sourceBulletId: null })"
          >Add bullet</UButton
        >
      </fieldset>
    </div>
  </AppFormModal>
</template>

<script setup lang="ts">
import type { ProfileData } from '~/composables/useProfile'
import {
  cvEntryLabel,
  selectCvTarget,
  type CvEntryDraft,
  type CvHistory
} from '~/utils/profileCvImport'

const props = defineProps<{
  kind: CvHistory
  profile: ProfileData
  path: string
  needsAttention?: boolean
}>()
const entry = defineModel<CvEntryDraft>({ required: true })
const targets = computed(() =>
  props.profile[props.kind].map((e) => ({ label: cvEntryLabel(e), value: e.id }))
)
const actions = computed(() => [
  { label: 'Add new', value: 'add' },
  // Nothing to update until the profile has an entry of this kind.
  ...(targets.value.length ? [{ label: 'Update existing', value: 'update' }] : []),
  { label: 'Skip', value: 'skip' }
])
const bulletActions = computed(() =>
  entry.value.action === 'update'
    ? actions.value
    : actions.value.filter((a) => a.value !== 'update')
)
const target = computed(() =>
  entry.value.action === 'update'
    ? props.profile[props.kind].find((e) => e.id === entry.value.id)
    : undefined
)
const bulletTargets = computed(
  () => target.value?.bullets.map((b) => ({ label: b.text, value: b.id })) ?? []
)
const fields = computed(() =>
  props.kind === 'experiences'
    ? ([
        { key: 'employer', label: 'Employer' },
        { key: 'title', label: 'Title' }
      ] as const)
    : props.kind === 'educations'
      ? ([
          { key: 'school', label: 'School' },
          { key: 'degree', label: 'Degree' },
          { key: 'field', label: 'Field of study' }
        ] as const)
      : props.kind === 'certifications'
        ? ([
            { key: 'name', label: 'Name' },
            { key: 'issuer', label: 'Issuer' },
            { key: 'url', label: 'URL' }
          ] as const)
        : ([
            { key: 'name', label: 'Name' },
            { key: 'url', label: 'URL' }
          ] as const)
)
const changeAction = () => {
  if (entry.value.action !== 'update')
    selectCvTarget(entry.value, props.kind, undefined, props.profile)
}
const changeTarget = (id: number | undefined) =>
  selectCvTarget(entry.value, props.kind, id, props.profile)
const skipped = computed(() => entry.value.action === 'skip')
const expanded = ref(!!props.needsAttention)
const title = computed(() => cvEntryLabel(entry.value) || 'Untitled entry')
const subtitle = computed(() =>
  props.kind === 'educations'
    ? [entry.value.degree, entry.value.field].filter(Boolean).join(', ')
    : props.kind === 'certifications'
      ? entry.value.issuer
      : ''
)
// The saved entry's values for the comparison when updating one.
const currentText = (key: string) => {
  const value = target.value?.[key as keyof NonNullable<typeof target.value>]
  return typeof value === 'string' ? value : null
}
const currentBullet = (id: number | undefined) =>
  target.value?.bullets.find((b) => b.id === id)?.text
// CV import only runs on English-primary profiles, so its dates are English like the profile's.
const CV_LOCALE = 'en-GB'

const dates = computed(() =>
  props.kind === 'certifications'
    ? formatMonthRange(entry.value.issuedMonth, entry.value.expiresMonth, undefined, CV_LOCALE)
    : formatMonthRange(
        entry.value.startMonth,
        entry.value.endMonth,
        entry.value.confirmedOngoing ? 'Present' : undefined,
        CV_LOCALE
      )
)
const currentLocation = computed(() =>
  target.value && 'location' in target.value && target.value.location
    ? formatLocation(target.value.location)
    : null
)
const currentSkills = computed(() =>
  target.value && 'skills' in target.value
    ? target.value.skills.map((s) => s.name).join(', ')
    : null
)
const currentDates = computed(() => {
  const t = target.value
  if (!t) return null
  return 'startMonth' in t
    ? formatMonthRange(t.startMonth, t.endMonth, undefined, CV_LOCALE)
    : formatMonthRange(t.issuedMonth, t.expiresMonth, undefined, CV_LOCALE)
})
</script>

<template>
  <div
    class="rounded-lg border border-default p-4"
    :class="{ 'bg-muted': skipped }"
    :data-testid="path"
  >
    <div class="flex flex-wrap items-start gap-2">
      <div class="min-w-0 flex-1" :data-testid="`${path}-header`">
        <p class="break-words font-medium" :class="skipped ? 'text-muted' : 'text-highlighted'">
          {{ title }}
        </p>
        <p v-if="subtitle" class="break-words text-sm" :class="{ 'text-muted': skipped }">
          {{ subtitle }}
        </p>
        <p v-if="dates" class="text-sm text-muted">{{ dates }}</p>
      </div>
      <UBadge v-if="needsAttention" color="warning" variant="subtle">Needs attention</UBadge>
      <USelect
        v-model="entry.action"
        :items="actions"
        :aria-label="`Action for ${title}`"
        class="w-full sm:w-44"
        :data-testid="`${path}-action`"
        @update:model-value="changeAction"
      />
    </div>
    <ProfileCvField :path="path" exact class="mt-2" />
    <details
      v-if="!skipped"
      :open="expanded"
      @toggle="expanded = ($event.target as HTMLDetailsElement).open"
    >
      <summary class="mt-2 cursor-pointer text-sm text-muted">Edit fields</summary>
      <div class="mt-4 space-y-4">
        <ProfileCvField
          v-if="entry.action === 'update'"
          :path="`${path}.id`"
          label="Existing entry to update"
          help="Choose manually. Similar entries are not matched automatically."
        >
          <USelect
            v-model="entry.id"
            :items="targets"
            placeholder="Choose an entry"
            class="w-full"
            :data-testid="`${path}-target`"
            @update:model-value="changeTarget"
          />
        </ProfileCvField>
        <!-- An update compares each field with the saved entry; a new entry has nothing to compare. -->
        <div class="grid gap-4" :class="{ 'sm:grid-cols-2': !target }">
          <ProfileCvField
            v-for="field in fields"
            :key="field.key"
            :path="`${path}.${field.key}`"
            :label="field.label"
          >
            <AppCompareBlock
              :compare="!!target"
              :current="currentText(field.key)"
              suggested-label="From your CV"
            >
              <template #suggested>
                <UInput
                  v-model="entry[field.key]"
                  class="w-full"
                  :data-testid="`${path}-${field.key}`"
                />
              </template>
            </AppCompareBlock>
          </ProfileCvField>
        </div>
        <AppCompareBlock
          :compare="!!target"
          :current="currentDates"
          current-label="Current dates"
          suggested-label="From your CV"
        >
          <template #suggested>
            <div class="grid gap-4" :class="{ 'sm:grid-cols-2': !target }">
              <template v-if="kind === 'certifications'">
                <ProfileCvField :path="`${path}.issuedMonth`" label="Issued month"
                  ><AppMonthField v-model="entry.issuedMonth"
                /></ProfileCvField>
                <ProfileCvField :path="`${path}.expiresMonth`" label="Expiry month"
                  ><AppMonthField v-model="entry.expiresMonth"
                /></ProfileCvField>
              </template>
              <template v-else>
                <ProfileCvField :path="`${path}.startMonth`" label="Start month"
                  ><AppMonthField v-model="entry.startMonth"
                /></ProfileCvField>
                <div class="space-y-2">
                  <ProfileCvField :path="`${path}.endMonth`" label="End month"
                    ><AppMonthField v-model="entry.endMonth"
                  /></ProfileCvField>
                  <!-- Outside the field: a checkbox inside it would share the month input's id. -->
                  <UCheckbox
                    v-if="(kind === 'experiences' || kind === 'educations') && !entry.endMonth"
                    v-model="entry.confirmedOngoing"
                    label="Current"
                    :data-testid="`${path}-ongoing`"
                  />
                </div>
              </template>
            </div>
          </template>
        </AppCompareBlock>
        <ProfileCvField v-if="kind !== 'certifications'" :path="`${path}.location`">
          <AppCompareBlock
            :compare="!!target"
            :current="currentLocation"
            current-label="Current location"
            suggested-label="From your CV"
          >
            <template #suggested>
              <ProfileLocationField
                v-model:country-code="entry.location.countryCode"
                v-model:city="entry.location.city"
              />
            </template>
          </AppCompareBlock>
        </ProfileCvField>
        <ProfileCvField
          v-if="kind === 'experiences' || kind === 'projects'"
          :path="`${path}.skillNames`"
          label="Skill tags"
          help="Missing profile skills are added at level 1; existing levels stay unchanged."
        >
          <AppCompareBlock
            :compare="!!target"
            :current="currentSkills"
            suggested-label="From your CV"
          >
            <template #suggested>
              <ProfileNamesField v-model="entry.skillNames" lookup="skills" />
            </template>
          </AppCompareBlock>
        </ProfileCvField>
        <div class="space-y-1">
          <p class="text-sm font-medium text-highlighted">Bullets</p>
          <p class="text-sm text-muted">
            Skipped and unlisted bullets stay unchanged. Import does not delete or reorder bullets.
          </p>
          <ProfileCvField :path="`${path}.bullets`" exact />
          <ul class="divide-y divide-default">
            <li v-for="(bullet, i) in entry.bullets" :key="i" class="space-y-2 py-2">
              <!-- Choices first, so picking the saved bullet adds the comparison below, not above. -->
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start">
                <USelect
                  v-model="bullet.action"
                  :items="bulletActions"
                  :aria-label="`Bullet ${i + 1} action`"
                  class="w-full sm:w-40"
                  :data-testid="`${path}-bullet-${i}-action`"
                />
                <ProfileCvField
                  v-if="bullet.action === 'update'"
                  :path="`${path}.bullets[${i}].id`"
                  class="min-w-0 flex-1"
                >
                  <USelect
                    v-model="bullet.id"
                    :items="bulletTargets"
                    placeholder="Choose the saved bullet to update"
                    :aria-label="`Saved bullet for bullet ${i + 1}`"
                    class="w-full"
                    :data-testid="`${path}-bullet-${i}-target`"
                  />
                </ProfileCvField>
              </div>
              <AppCompareBlock
                :compare="bullet.action === 'update' && !!bullet.id"
                :current="currentBullet(bullet.id)"
                suggested-label="From your CV"
              >
                <template #suggested>
                  <ProfileCvField :path="`${path}.bullets[${i}].text`">
                    <UTextarea
                      v-model="bullet.text"
                      :rows="2"
                      autoresize
                      :disabled="bullet.action === 'skip'"
                      :aria-label="`Bullet ${i + 1}`"
                      class="w-full"
                      :data-testid="`${path}-bullet-${i}-text`"
                    />
                  </ProfileCvField>
                </template>
              </AppCompareBlock>
              <ProfileCvField :path="`${path}.bullets[${i}]`" exact />
            </li>
          </ul>
          <UButton
            color="neutral"
            variant="subtle"
            icon="i-lucide-plus"
            :disabled="entry.bullets.length >= 20"
            @click="entry.bullets.push({ action: 'add', text: '' })"
            >Add bullet</UButton
          >
        </div>
      </div>
    </details>
  </div>
</template>

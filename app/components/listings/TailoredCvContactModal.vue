<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { TailoredCv } from '~/utils/tailoredCv'
import { CV_APPLY_DESCRIPTION } from '~/constants/listing'

// The tailored CV's contact lines, headline and links, edited on a copy; Apply puts them back into
// the page's draft.
type Contact = Pick<
  TailoredCv,
  | 'fullName'
  | 'headline'
  | 'email'
  | 'phone'
  | 'address'
  | 'dateOfBirth'
  | 'referencesOnRequest'
  | 'links'
>
// `profile`: the API's prefill from the profile, what a cleared field or removed link comes back from.
const props = defineProps<{ cv: TailoredCv; profile?: TailoredCv | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ apply: [contact: Contact] }>()

const pick = (cv: TailoredCv): Contact =>
  JSON.parse(
    JSON.stringify({
      fullName: cv.fullName,
      headline: cv.headline,
      email: cv.email,
      phone: cv.phone,
      address: cv.address,
      dateOfBirth: cv.dateOfBirth,
      referencesOnRequest: cv.referencesOnRequest,
      links: cv.links
    })
  )
const draft = ref(pick(props.cv))
watch(open, (isOpen) => {
  if (isOpen) draft.value = pick(props.cv)
})

// A field left empty here offers the profile's value back, one field at a time: a cleared date of
// birth is often on purpose, so nothing refills on its own.
type TextField = 'fullName' | 'headline' | 'email' | 'phone' | 'address' | 'dateOfBirth'
const FIELD_NAMES: Record<TextField, string> = {
  fullName: 'full name',
  headline: 'headline',
  email: 'email',
  phone: 'phone',
  address: 'address',
  dateOfBirth: 'date of birth'
}
const fromProfile = (field: TextField) => {
  const value = props.profile?.[field]?.trim()
  return value && !draft.value[field].trim() ? value : ''
}
const shown = (field: TextField, value: string) =>
  field === 'dateOfBirth' ? formatDate(value, 'en-GB') : value
const [DefineFromProfile, FromProfile] = createReusableTemplate<{ field: TextField }>()

const linkItems = computed<DropdownMenuItem[]>(() => {
  if (!props.profile) return [{ label: 'Your profile isn’t loaded yet', disabled: true }]
  const links = missingLinks(draft.value.links, props.profile)
  if (!links.length)
    return [{ label: 'Everything from your profile is already here', disabled: true }]
  return links.map((link) => ({
    label: link.label.trim() || link.url.trim().replace(/^https?:\/\//, ''),
    onSelect: () => draft.value.links.push(link)
  }))
})

const apply = () => {
  emit('apply', draft.value)
  open.value = false
}
</script>

<template>
  <DefineFromProfile v-slot="{ field }">
    <!-- Negative margins + padding: a phone-sized tap area without a bigger-looking link or gap.
         The value goes last, so a long one truncates instead of the action. -->
    <UButton
      variant="link"
      color="neutral"
      size="sm"
      icon="i-lucide-undo-2"
      class="-mx-2 -my-1 max-w-full px-2 py-2"
      :title="fromProfile(field)"
      :aria-label="`Use ${FIELD_NAMES[field]} from profile: ${shown(field, fromProfile(field))}`"
      :data-testid="`cv-from-profile-${field}`"
      @click="draft[field] = fromProfile(field)"
    >
      <span class="truncate">Use from profile: {{ shown(field, fromProfile(field)) }}</span>
    </UButton>
  </DefineFromProfile>
  <AppFormModal
    v-model:open="open"
    title="Edit contact and headline"
    :description="CV_APPLY_DESCRIPTION"
    save-label="Apply"
    :state="draft"
    @submit="apply"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField label="Full name">
        <UInput v-model="draft.fullName" class="w-full" autocomplete="name" />
        <template v-if="fromProfile('fullName')" #help><FromProfile field="fullName" /></template>
      </UFormField>
      <UFormField label="Headline">
        <UInput v-model="draft.headline" class="w-full" data-testid="tailored-cv-headline" />
        <template v-if="fromProfile('headline')" #help><FromProfile field="headline" /></template>
      </UFormField>
      <UFormField label="Email">
        <UInput v-model="draft.email" type="email" class="w-full" autocomplete="email" />
        <template v-if="fromProfile('email')" #help><FromProfile field="email" /></template>
      </UFormField>
      <UFormField label="Phone">
        <UInput v-model="draft.phone" type="tel" class="w-full" autocomplete="tel" />
        <template v-if="fromProfile('phone')" #help><FromProfile field="phone" /></template>
      </UFormField>
      <UFormField label="Address" class="sm:col-span-2">
        <UInput v-model="draft.address" class="w-full" autocomplete="street-address" />
        <template v-if="fromProfile('address')" #help><FromProfile field="address" /></template>
      </UFormField>
      <UFormField label="Date of birth">
        <UFieldGroup class="w-full">
          <UInput v-model="draft.dateOfBirth" type="date" class="w-full" />
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-x"
            aria-label="Clear date of birth"
            data-testid="cv-dob-clear"
            :disabled="!draft.dateOfBirth"
            @click="draft.dateOfBirth = ''"
          />
        </UFieldGroup>
        <template v-if="fromProfile('dateOfBirth')" #help
          ><FromProfile field="dateOfBirth"
        /></template>
      </UFormField>
      <UFormField label="References" class="self-end">
        <USwitch v-model="draft.referencesOnRequest" label="Available on request" />
      </UFormField>
    </div>
    <fieldset class="mt-4 space-y-2">
      <legend class="mb-2 text-sm font-medium">Links</legend>
      <div
        v-for="(link, i) in draft.links"
        :key="i"
        class="flex flex-col gap-2 sm:flex-row sm:items-start"
      >
        <UInput
          v-model="link.label"
          placeholder="Label"
          class="sm:w-40"
          :aria-label="`Link ${i + 1} label`"
        />
        <div class="flex flex-1 gap-2">
          <UInput
            v-model="link.url"
            type="url"
            placeholder="https://"
            class="flex-1"
            :aria-label="`Link ${i + 1} URL`"
          />
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            :aria-label="`Remove link ${i + 1}`"
            @click="draft.links.splice(i, 1)"
          />
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="subtle"
          size="sm"
          @click="draft.links.push({ label: '', url: '' })"
          >Add link</UButton
        >
        <!-- Capped width: long link labels mustn't push the menu off a phone screen. -->
        <UDropdownMenu
          :items="linkItems"
          :content="{ align: 'start' }"
          :ui="{ content: 'max-w-[min(20rem,calc(100vw-2rem))]' }"
        >
          <UButton
            icon="i-lucide-user-round-plus"
            trailing-icon="i-lucide-chevron-down"
            color="neutral"
            variant="subtle"
            size="sm"
            data-testid="cv-links-from-profile"
            >Add from profile</UButton
          >
        </UDropdownMenu>
      </div>
    </fieldset>
  </AppFormModal>
</template>

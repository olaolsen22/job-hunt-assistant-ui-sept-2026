<script setup lang="ts">
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
const props = defineProps<{ cv: TailoredCv }>()
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

const apply = () => {
  emit('apply', draft.value)
  open.value = false
}
</script>

<template>
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
      </UFormField>
      <UFormField label="Headline">
        <UInput v-model="draft.headline" class="w-full" data-testid="tailored-cv-headline" />
      </UFormField>
      <UFormField label="Email">
        <UInput v-model="draft.email" type="email" class="w-full" autocomplete="email" />
      </UFormField>
      <UFormField label="Phone">
        <UInput v-model="draft.phone" type="tel" class="w-full" autocomplete="tel" />
      </UFormField>
      <UFormField label="Address" class="sm:col-span-2">
        <UInput v-model="draft.address" class="w-full" autocomplete="street-address" />
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
      <UButton
        icon="i-lucide-plus"
        color="neutral"
        variant="subtle"
        size="sm"
        @click="draft.links.push({ label: '', url: '' })"
        >Add link</UButton
      >
    </fieldset>
  </AppFormModal>
</template>

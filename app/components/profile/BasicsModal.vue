<script setup lang="ts">
import { LINK_KIND_OPTIONS } from '~/constants/listing'
import type { ProfileData, ProfileLink } from '~/composables/useProfile'

// The header's details: everything in the basics except the summary and hobbies, which have their
// own small forms.
const { profile } = defineProps<{ profile: ProfileData }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [profile: ProfileData]; changed: [] }>()

const MAX_LINKS = 10

const fullName = ref('')
const headline = ref('')
const email = ref('')
const phone = ref('')
const countryCode = ref<string>()
const city = ref<string>()
const dateOfBirth = ref('')
const nationality = ref('')
const workAuthorization = ref('')
const links = ref<{ kind: ProfileLink['kind']; label: string; url: string }[]>([])

watch(open, (isOpen) => {
  if (!isOpen) return
  fullName.value = profile.fullName ?? ''
  headline.value = profile.headline ?? ''
  email.value = profile.email ?? ''
  phone.value = profile.phone ?? ''
  countryCode.value = profile.location?.countryCode
  city.value = profile.location?.city ?? undefined
  dateOfBirth.value = profile.dateOfBirth ?? ''
  nationality.value = profile.nationality ?? ''
  workAuthorization.value = profile.workAuthorization ?? ''
  links.value = profile.links.map((l) => ({ ...l, label: l.label ?? '' }))
})

const state = computed(() => ({
  fullName: fullName.value,
  headline: headline.value,
  email: email.value,
  phone: phone.value,
  countryCode: countryCode.value,
  city: city.value,
  dateOfBirth: dateOfBirth.value,
  nationality: nationality.value,
  workAuthorization: workAuthorization.value,
  links: links.value
}))

const { save, loading } = useProfileUpdate(() => emit('changed'))

const submit = async () => {
  // Empty text goes out as null.
  const saved = await save(profile, {
    fullName: fullName.value.trim() || null,
    headline: headline.value.trim() || null,
    email: email.value.trim() || null,
    phone: phone.value.trim() || null,
    dateOfBirth: dateOfBirth.value || null,
    nationality: nationality.value.trim() || null,
    workAuthorization: workAuthorization.value.trim() || null,
    location: locationInput(countryCode.value, city.value),
    // A blank row has no URL; the label is optional.
    links: links.value
      .filter((l) => l.url.trim())
      .map((l) => ({
        kind: l.kind,
        label: l.kind === 'OTHER' ? l.label.trim() || null : null,
        url: l.url.trim()
      }))
  })
  if (!saved) return
  // A new city is a new name, so the cached suggestions are stale.
  clearNuxtState('name-lookups')
  open.value = false
  emit('saved', saved)
}
</script>

<template>
  <AppFormModal
    v-model:open="open"
    title="Edit details"
    :state="state"
    :loading="loading"
    @submit="submit"
  >
    <div class="space-y-6">
      <section class="space-y-4">
        <h3 class="text-sm font-medium text-muted">Identity</h3>
        <UFormField label="Full name">
          <UInput v-model="fullName" class="w-full" data-testid="basics-full-name" />
        </UFormField>
        <UFormField label="Headline">
          <UInput
            v-model="headline"
            placeholder="Senior frontend developer"
            class="w-full"
            data-testid="basics-headline"
          />
        </UFormField>
      </section>

      <section class="space-y-4">
        <h3 class="text-sm font-medium text-muted">Contact</h3>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Email">
            <UInput v-model="email" type="email" class="w-full" />
          </UFormField>
          <UFormField label="Phone">
            <UInput v-model="phone" type="tel" class="w-full" />
          </UFormField>
        </div>
        <ProfileLocationField v-model:country-code="countryCode" v-model:city="city" />
      </section>

      <section class="space-y-4">
        <h3 class="text-sm font-medium text-muted">Personal</h3>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Date of birth">
            <UInput v-model="dateOfBirth" type="date" class="w-full" data-testid="basics-dob" />
          </UFormField>
          <UFormField label="Nationality">
            <UInput v-model="nationality" class="w-full" />
          </UFormField>
        </div>
        <UFormField label="Work authorization">
          <UInput v-model="workAuthorization" placeholder="EU citizen" class="w-full" />
        </UFormField>
      </section>

      <section class="space-y-4">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-medium text-muted">Links</h3>
          <span class="text-sm text-muted">{{ links.length }} / {{ MAX_LINKS }}</span>
        </div>
        <!-- The label only exists for OTHER; the other kinds are named by their kind. -->
        <div v-for="(link, i) in links" :key="i" class="flex items-start gap-2">
          <div class="grid min-w-0 flex-1 gap-2 sm:grid-cols-[auto_1fr]">
            <USelect
              v-model="link.kind"
              :items="[...LINK_KIND_OPTIONS]"
              aria-label="Link type"
              class="w-full sm:w-32"
              data-testid="basics-link-kind"
            />
            <div class="flex min-w-0 gap-2">
              <UInput
                v-if="link.kind === 'OTHER'"
                v-model="link.label"
                placeholder="Label"
                aria-label="Link label"
                class="w-28 shrink-0"
              />
              <UInput
                v-model="link.url"
                placeholder="https://"
                aria-label="Link URL"
                class="min-w-0 flex-1"
              />
            </div>
          </div>
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            aria-label="Remove link"
            class="shrink-0"
            @click="links.splice(i, 1)"
          />
        </div>
        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="subtle"
          :disabled="links.length >= MAX_LINKS"
          data-testid="basics-add-link"
          @click="links.push({ kind: 'OTHER', label: '', url: '' })"
          >Add link</UButton
        >
      </section>
    </div>
  </AppFormModal>
</template>

<script setup lang="ts">
import { LINK_KIND_OPTIONS } from '~/constants/listing'
import type { ProfileData, ProfileLink } from '~/composables/useProfile'

const { profile } = defineProps<{ profile: ProfileData }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [profile: ProfileData]; changed: [] }>()

const MAX_LINKS = 10

const UPDATE_PROFILE = graphql(
  `
    mutation UpdateProfile($input: UpdateProfileInput!) {
      updateProfile(input: $input) {
        profile {
          ...ProfileFields
        }
        errors {
          __typename
          ... on Error {
            message
          }
        }
      }
    }
  `,
  [PROFILE_FIELDS]
)

const fullName = ref('')
const headline = ref('')
const email = ref('')
const phone = ref('')
const countryCode = ref<string>()
const city = ref<string>()
const dateOfBirth = ref('')
const nationality = ref('')
const workAuthorization = ref('')
const hobbies = ref<string[]>([])
const links = ref<{ kind: ProfileLink['kind']; label: string; url: string }[]>([])
const summary = ref('')

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
  hobbies.value = [...profile.hobbies]
  links.value = profile.links.map((l) => ({ ...l }))
  summary.value = profile.summary ?? ''
})

const { run, loading } = useMutation(() => emit('changed'))

const submit = async () => {
  // Full replace: every field goes out, empty text as null.
  const input = {
    fullName: fullName.value.trim() || null,
    headline: headline.value.trim() || null,
    email: email.value.trim() || null,
    phone: phone.value.trim() || null,
    summary: summary.value.trim() || null,
    dateOfBirth: dateOfBirth.value || null,
    nationality: nationality.value.trim() || null,
    workAuthorization: workAuthorization.value.trim() || null,
    hobbies: hobbies.value,
    location: locationInput(countryCode.value, city.value),
    // A blank row has no URL; the label is optional.
    links: links.value
      .filter((l) => l.url.trim())
      .map((l) => ({
        kind: l.kind,
        label: l.kind === 'OTHER' ? l.label.trim() || null : null,
        url: l.url.trim()
      }))
  }
  let saved: ProfileData | null = null
  const ok = await run(async () => {
    const { updateProfile } = await gql(UPDATE_PROFILE, { input })
    saved = updateProfile.profile
    return updateProfile.errors
  })
  if (!ok || !saved) return
  // A new city is a new name, so the cached suggestions are stale.
  clearNuxtState('name-lookups')
  open.value = false
  emit('saved', saved)
}
</script>

<template>
  <AppConfirmModal
    v-model:open="open"
    title="Edit profile"
    confirm-label="Save"
    :loading="loading"
    @confirm="submit"
  >
    <div class="space-y-4">
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
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Email">
          <UInput v-model="email" type="email" class="w-full" />
        </UFormField>
        <UFormField label="Phone">
          <UInput v-model="phone" type="tel" class="w-full" />
        </UFormField>
      </div>

      <ProfileLocationField v-model:country-code="countryCode" v-model:city="city" />

      <div class="grid gap-4 sm:grid-cols-3">
        <UFormField label="Date of birth">
          <UInput v-model="dateOfBirth" type="date" class="w-full" data-testid="basics-dob" />
        </UFormField>
        <UFormField label="Nationality">
          <UInput v-model="nationality" class="w-full" />
        </UFormField>
        <UFormField label="Work authorization">
          <UInput v-model="workAuthorization" placeholder="EU citizen" class="w-full" />
        </UFormField>
      </div>

      <UFormField label="Links" :hint="`${links.length} / ${MAX_LINKS}`">
        <div class="space-y-2">
          <!-- The label only exists for OTHER; the other kinds are named by their kind. -->
          <div v-for="(link, i) in links" :key="i" class="flex flex-wrap items-center gap-2">
            <USelect
              v-model="link.kind"
              :items="[...LINK_KIND_OPTIONS]"
              aria-label="Link type"
              class="w-32 shrink-0"
              data-testid="basics-link-kind"
            />
            <UInput
              v-if="link.kind === 'OTHER'"
              v-model="link.label"
              placeholder="Label"
              aria-label="Link label"
              class="min-w-32 flex-1"
            />
            <UInput
              v-model="link.url"
              placeholder="https://"
              aria-label="Link URL"
              class="min-w-48 flex-1"
            />
            <UButton
              icon="i-lucide-x"
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
        </div>
      </UFormField>

      <UFormField label="Hobbies">
        <ProfileNamesField v-model="hobbies" placeholder="Add a hobby" />
      </UFormField>

      <AppMarkdownEditor v-model="summary" label="Summary" />
    </div>
  </AppConfirmModal>
</template>

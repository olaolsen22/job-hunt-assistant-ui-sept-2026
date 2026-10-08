<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { LINK_KIND_OPTIONS } from '~/constants/listing'
import type { ProfileData } from '~/composables/useProfile'

definePageMeta({ title: 'Profile' })

const { profile, loading, error, refresh } = useProfile()

const basicsOpen = ref(false)

const kindOf = (kind: string) => LINK_KIND_OPTIONS.find((o) => o.value === kind)!

// Basics and Preferences return the whole profile, so it replaces ours without a refetch.
const onSaved = (saved: ProfileData) => {
  profile.value = saved
}

const contact = computed(() => {
  const p = profile.value
  if (!p) return []
  return [
    { icon: 'i-lucide-mail', text: p.email, testid: 'profile-email' },
    { icon: 'i-lucide-phone', text: p.phone, testid: 'profile-phone' },
    {
      icon: 'i-lucide-map-pin',
      text: p.location ? formatLocation(p.location) : null,
      testid: 'profile-location'
    },
    {
      icon: 'i-lucide-cake',
      text: p.dateOfBirth ? formatDate(p.dateOfBirth) : null,
      testid: 'profile-dob'
    },
    { icon: 'i-lucide-flag', text: p.nationality, testid: 'profile-nationality' },
    {
      icon: 'i-lucide-id-card',
      text: p.workAuthorization,
      testid: 'profile-work-authorization'
    }
  ].filter((row) => row.text)
})
</script>

<template>
  <div class="flex justify-center">
    <div class="w-full max-w-3xl space-y-4 sm:space-y-6 lg:max-w-6xl">
      <UAlert v-if="error" color="error" :description="ERROR_MESSAGES.generic" />

      <!-- Only on first load: refreshes after an edit keep the page (and its modals) mounted. -->
      <div v-else-if="loading && !profile" class="space-y-4" data-testid="profile-loading">
        <USkeleton class="h-24 w-full" />
        <div class="grid gap-4 lg:grid-cols-3">
          <USkeleton class="h-64 w-full lg:col-span-2" />
          <div class="space-y-4">
            <USkeleton class="h-32 w-full" />
            <USkeleton class="h-40 w-full" />
          </div>
        </div>
      </div>

      <template v-else-if="profile">
        <header class="space-y-3" data-testid="profile-header">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <h1 class="break-words text-xl font-semibold text-highlighted">
                {{ profile.fullName ?? 'Your profile' }}
              </h1>
              <p v-if="profile.headline" class="text-muted">{{ profile.headline }}</p>
            </div>
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="subtle"
              class="shrink-0"
              data-testid="profile-edit"
              @click="basicsOpen = true"
              >Edit</UButton
            >
          </div>

          <ul v-if="contact.length" class="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <li
              v-for="row in contact"
              :key="row.icon"
              class="flex items-center gap-2"
              :data-testid="row.testid"
            >
              <UIcon :name="row.icon" class="size-4 shrink-0 text-muted" />
              <span class="break-all">{{ row.text }}</span>
            </li>
          </ul>

          <div v-if="profile.links.length" class="flex flex-wrap gap-2" data-testid="profile-links">
            <UButton
              v-for="link in profile.links"
              :key="link.url"
              :to="link.url"
              target="_blank"
              rel="noopener noreferrer"
              :icon="kindOf(link.kind).icon"
              color="neutral"
              variant="outline"
              size="sm"
              >{{ link.label || kindOf(link.kind).label }}</UButton
            >
          </div>
        </header>

        <div class="grid items-start gap-4 lg:grid-cols-3">
          <div class="space-y-4 lg:col-span-2">
            <ProfileSection
              title="Summary"
              icon="i-lucide-notebook-pen"
              testid="profile-summary"
              :empty="!profile.summary"
              empty-message="No summary yet."
              add-label="Add summary"
              @add="basicsOpen = true"
            >
              <template v-if="profile.summary" #actions>
                <UButton
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  aria-label="Edit summary"
                  data-testid="profile-summary-edit"
                  @click="basicsOpen = true"
                />
              </template>
              <LazyAppMarkdownContent v-if="profile.summary" :source="profile.summary" />
            </ProfileSection>

            <ProfileExperienceList :experiences="profile.experiences" @changed="refresh" />

            <ProfileProjectList :projects="profile.projects" @changed="refresh" />

            <ProfileEducationList :educations="profile.educations" @changed="refresh" />

            <ProfileReferenceList :references="profile.references" @changed="refresh" />
          </div>

          <div class="space-y-4">
            <ProfilePreferencesCard :profile="profile" @saved="onSaved" @changed="refresh" />

            <ProfileSkillList :skills="profile.skills" @changed="refresh" />

            <ProfileLanguageList :languages="profile.languages" @changed="refresh" />

            <ProfileSection
              title="Hobbies"
              icon="i-lucide-palette"
              testid="profile-hobbies"
              :empty="!profile.hobbies.length"
              empty-message="No hobbies yet."
              add-label="Add hobbies"
              @add="basicsOpen = true"
            >
              <template v-if="profile.hobbies.length" #actions>
                <UButton
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  aria-label="Edit hobbies"
                  data-testid="profile-hobbies-edit"
                  @click="basicsOpen = true"
                />
              </template>
              <div class="flex flex-wrap gap-2">
                <UBadge v-for="h in profile.hobbies" :key="h" color="neutral" variant="subtle">{{
                  h
                }}</UBadge>
              </div>
            </ProfileSection>

            <ProfileCertificationList :certifications="profile.certifications" @changed="refresh" />
          </div>
        </div>

        <ProfileBasicsModal
          v-model:open="basicsOpen"
          :profile="profile"
          @saved="onSaved"
          @changed="refresh"
        />
      </template>
    </div>
  </div>
</template>

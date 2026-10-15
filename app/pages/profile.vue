<script setup lang="ts">
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { LINK_KIND_OPTIONS } from '~/constants/listing'
import { LANGUAGE_OPTIONS, type Language } from '~/constants/listing'
import type { DropdownMenuItem } from '@nuxt/ui'
import { PROFILE, type ProfileData } from '~/composables/useProfile'
import type { ProfileSectionName } from '~/components/profile/ClearSectionsModal.vue'
import { STORY_FIELDS } from '~/constants/profileStory'

definePageMeta({ title: 'Profile' })

const { profile, loading, error, refresh } = useProfile()

const basicsOpen = ref(false)
const summaryOpen = ref(false)
const hobbiesOpen = ref(false)
const storyOpen = ref(false)
const addressOpen = ref(false)
const cvImportOpen = ref(false)
const clearTarget = ref<ProfileSectionName | 'ALL' | null>(null)

const hasAddress = computed(() => !!(profile.value?.streetAddress || profile.value?.postalCode))
const postalLine = computed(() =>
  [profile.value?.postalCode, profile.value?.location?.city].filter(Boolean).join(' ')
)
const hasStory = computed(() => STORY_FIELDS.some((f) => profile.value?.story[f.key]))

// Keep the mounted review and its edits if fetching fresh update targets fails.
const refreshCvProfile = async () => {
  profile.value = (await gql(PROFILE)).profile
}

const SET_CONTENT_LANGUAGE = graphql(`
  mutation SetProfileContentLanguage($input: SetProfileContentLanguageInput!) {
    setProfileContentLanguage(input: $input) {
      profile {
        contentLanguage
      }
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

// The translation is always in the language the profile isn't written in.
const translating = ref(false)
const target = computed<Language>(() =>
  profile.value?.contentLanguage === 'ENGLISH' ? 'NORWEGIAN' : 'ENGLISH'
)
// en-GB for English: day-month order and 24-hour habits match a Norwegian reader.
const locale = computed(() => (profile.value?.contentLanguage === 'ENGLISH' ? 'en-GB' : 'nb-NO'))
provideProfileTranslation({ translating, target, locale })
const targetLabel = computed(() => LANGUAGE_OPTIONS.find((o) => o.value === target.value)!.label)

const bulletsOf = (p: ProfileData) => [
  ...p.experiences.flatMap((e) => e.bullets),
  ...p.educations.flatMap((e) => e.bullets),
  ...p.certifications.flatMap((e) => e.bullets),
  ...p.projects.flatMap((e) => e.bullets)
]
const hasTranslations = computed(
  () =>
    !!profile.value &&
    (profile.value.translations.length > 0 ||
      bulletsOf(profile.value).some((b) => b.translations.length > 0))
)
// Progress for the translating bar: how many bullets have a translation in the target language.
const bulletProgress = computed(() => {
  const bullets = profile.value ? bulletsOf(profile.value) : []
  const done = bullets.filter((b) => b.translations.some((t) => t.language === target.value))
  return { done: done.length, total: bullets.length }
})
const staleCount = computed(() => {
  const p = profile.value
  if (!p) return 0
  return (
    p.translations.filter((t) => t.isHeadlineStale || t.isSummaryStale).length +
    bulletsOf(p).filter((b) => b.translations.some((t) => t.isStale)).length
  )
})

const { run: runLanguage, loading: languageLoading } = useMutation(() => refresh())
const changeContentLanguage = async (language: Language) => {
  const ok = await runLanguage(async () => {
    const { setProfileContentLanguage } = await gql(SET_CONTENT_LANGUAGE, { input: { language } })
    return setProfileContentLanguage.errors
  })
  // Text may now be read in the other language, so refetch rather than patch.
  if (ok) await refresh()
}

// The API rejects clearing nothing, so the menu only offers it when a CV section has content.
const hasCvContent = computed(() => {
  const p = profile.value
  if (!p) return false
  return (
    !!(p.headline || p.summary || p.translations.length || p.hobbies.length) ||
    [
      p.experiences,
      p.educations,
      p.certifications,
      p.projects,
      p.skills,
      p.languages,
      p.references
    ].some((list) => list.length > 0)
  )
})
const profileMenu = computed<DropdownMenuItem[]>(() => [
  {
    label: 'Clear CV content…',
    icon: 'i-lucide-eraser',
    color: 'error',
    onSelect: () => (clearTarget.value = 'ALL')
  }
])

const importAvailable = computed(() => profile.value?.contentLanguage === 'ENGLISH')

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
      text: p.dateOfBirth ? formatDate(p.dateOfBirth, locale.value) : null,
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
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <h1 class="break-words text-xl font-semibold text-highlighted">
                {{ profile.fullName ?? 'Your profile' }}
              </h1>
              <p v-if="profile.headline" class="text-muted">{{ profile.headline }}</p>
            </div>
            <div class="flex shrink-0 gap-2">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="subtle"
                data-testid="profile-edit"
                @click="basicsOpen = true"
                >Edit details</UButton
              >
              <!-- A disabled button gets no pointer or focus events, so the span carries the tooltip. -->
              <UTooltip
                text="CV import needs an English-primary profile. Change the CV language below."
                :disabled="importAvailable"
              >
                <span
                  :tabindex="importAvailable ? undefined : 0"
                  data-testid="profile-import-cv-wrap"
                >
                  <UButton
                    icon="i-lucide-clipboard-paste"
                    variant="subtle"
                    :disabled="!importAvailable"
                    data-testid="profile-import-cv"
                    @click="cvImportOpen = true"
                    >Import CV</UButton
                  >
                </span>
              </UTooltip>
              <UDropdownMenu v-if="hasCvContent" :items="profileMenu" :content="{ align: 'end' }">
                <UButton
                  icon="i-lucide-ellipsis-vertical"
                  color="neutral"
                  variant="ghost"
                  aria-label="More profile actions"
                  data-testid="profile-menu"
                />
              </UDropdownMenu>
            </div>
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

        <!-- Rarely changed settings, kept apart from the CV itself. -->
        <div
          class="flex flex-wrap items-center gap-2 border-y border-default py-2"
          data-testid="profile-translation-controls"
        >
          <span class="text-sm text-muted">CV language</span>
          <USelect
            :model-value="profile.contentLanguage"
            :items="[...LANGUAGE_OPTIONS]"
            :disabled="hasTranslations || languageLoading"
            aria-label="Content language"
            size="sm"
            class="w-36"
            data-testid="profile-content-language"
            @update:model-value="changeContentLanguage"
          />
          <!-- While translating, the sticky bar at the bottom holds Done instead. -->
          <UChip v-if="!translating" :show="staleCount > 0" color="warning" inset>
            <UButton
              icon="i-lucide-languages"
              color="neutral"
              variant="ghost"
              size="sm"
              data-testid="profile-translate-toggle"
              @click="translating = true"
              >Translate to {{ targetLabel }}</UButton
            >
          </UChip>
          <span
            v-if="hasTranslations"
            class="basis-full text-xs text-muted"
            data-testid="profile-content-language-hint"
            >Delete all translations before changing the content language.</span
          >
        </div>

        <div class="grid items-start gap-4 lg:grid-cols-3">
          <div class="space-y-4 lg:col-span-2">
            <ProfileSection
              title="Summary"
              icon="i-lucide-notebook-pen"
              testid="profile-summary"
              clearable
              :empty="!profile.summary"
              empty-message="No summary yet."
              add-label="Add summary"
              @add="summaryOpen = true"
              @clear="clearTarget = 'SUMMARY'"
            >
              <template v-if="profile.summary" #actions>
                <UButton
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  aria-label="Edit summary"
                  data-testid="profile-summary-edit"
                  @click="summaryOpen = true"
                />
              </template>
              <LazyAppMarkdownContent v-if="profile.summary" :source="profile.summary" />
              <ProfileTranslationBlock
                v-if="translating"
                :profile="profile"
                class="mt-3"
                @changed="refresh"
              />
            </ProfileSection>

            <ProfileExperienceList
              :experiences="profile.experiences"
              @changed="refresh"
              @clear="clearTarget = 'EXPERIENCES'"
            />

            <ProfileProjectList
              :projects="profile.projects"
              @changed="refresh"
              @clear="clearTarget = 'PROJECTS'"
            />

            <ProfileEducationList
              :educations="profile.educations"
              @changed="refresh"
              @clear="clearTarget = 'EDUCATIONS'"
            />

            <ProfileReferenceList
              :references="profile.references"
              @changed="refresh"
              @clear="clearTarget = 'REFERENCES'"
            />

            <!-- Cover letter material, kept together below the CV sections. -->
            <ProfileSection
              title="Address"
              icon="i-lucide-map-pin"
              testid="profile-address"
              :empty="!hasAddress"
              empty-message="No address yet. Add it to fill in the sender block on cover letters."
              add-label="Add address"
              @add="addressOpen = true"
            >
              <template v-if="hasAddress" #actions>
                <UButton
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  aria-label="Edit address"
                  data-testid="profile-address-edit"
                  @click="addressOpen = true"
                />
              </template>
              <div class="space-y-1 text-sm">
                <p v-if="profile.streetAddress" class="break-words">{{ profile.streetAddress }}</p>
                <p>{{ postalLine }}</p>
                <p v-if="!profile.location?.city" class="text-muted">Add your town under Basics.</p>
                <p class="text-xs text-muted">
                  Printed in the sender block of cover letters. Never sent to AI.
                </p>
              </div>
            </ProfileSection>

            <ProfileSection
              title="My story"
              icon="i-lucide-book-open"
              testid="profile-story"
              clearable
              :empty="!hasStory"
              empty-message="Tell your story for cover letters. Optional, and only cover letters use it."
              add-label="Add your story"
              @add="storyOpen = true"
              @clear="clearTarget = 'STORY'"
            >
              <template v-if="hasStory" #actions>
                <UButton
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  aria-label="Edit story"
                  data-testid="profile-story-edit"
                  @click="storyOpen = true"
                />
              </template>
              <dl class="space-y-3">
                <div v-for="f in STORY_FIELDS" :key="f.key">
                  <dt class="text-xs text-muted">{{ f.label }}</dt>
                  <dd
                    class="line-clamp-2 whitespace-pre-line break-words text-sm"
                    :class="{ 'text-muted': !profile.story[f.key] }"
                  >
                    {{ profile.story[f.key] || 'Not written' }}
                  </dd>
                </div>
              </dl>
            </ProfileSection>

            <ProfileWritingSampleList />
          </div>

          <div class="space-y-4">
            <ProfileSkillList
              :skills="profile.skills"
              :profile="profile"
              @changed="refresh"
              @clear="clearTarget = 'SKILLS'"
            />

            <ProfileLanguageList
              :languages="profile.languages"
              @changed="refresh"
              @clear="clearTarget = 'LANGUAGES'"
            />

            <ProfileSection
              title="Hobbies"
              icon="i-lucide-palette"
              testid="profile-hobbies"
              clearable
              :empty="!profile.hobbies.length"
              empty-message="No hobbies yet."
              add-label="Add hobbies"
              @add="hobbiesOpen = true"
              @clear="clearTarget = 'HOBBIES'"
            >
              <template v-if="profile.hobbies.length" #actions>
                <UButton
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  aria-label="Edit hobbies"
                  data-testid="profile-hobbies-edit"
                  @click="hobbiesOpen = true"
                />
              </template>
              <div class="flex flex-wrap gap-2">
                <UBadge v-for="h in profile.hobbies" :key="h" color="neutral" variant="subtle">{{
                  h
                }}</UBadge>
              </div>
            </ProfileSection>

            <ProfileCertificationList
              :certifications="profile.certifications"
              @changed="refresh"
              @clear="clearTarget = 'CERTIFICATIONS'"
            />

            <ProfilePreferencesCard :profile="profile" @saved="onSaved" @changed="refresh" />
          </div>
        </div>

        <!-- Sticky so Done stays in reach on a long profile; same bar style as the tailored CV editor. -->
        <div
          v-if="translating"
          class="sticky bottom-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-default bg-default/90 p-3 backdrop-blur"
          data-testid="profile-translating-bar"
        >
          <UIcon name="i-lucide-languages" class="size-5 shrink-0 text-primary" />
          <div class="min-w-0 flex-1 text-sm">
            <p class="font-medium text-highlighted">
              Translating to {{ targetLabel }}
              <span class="font-normal text-muted" data-testid="profile-translating-progress"
                >· {{ bulletProgress.done }} of {{ bulletProgress.total }} bullets</span
              >
            </p>
            <p class="text-muted">
              Summary and bullets only. Titles, dates and other sections are used as written.
            </p>
          </div>
          <UButton
            icon="i-lucide-check"
            data-testid="profile-translate-done"
            class="w-full justify-center sm:w-auto"
            @click="translating = false"
            >Done translating</UButton
          >
        </div>

        <ProfileClearSectionsModal
          v-model:target="clearTarget"
          :profile="profile"
          @saved="onSaved"
          @changed="refresh"
        />
        <LazyProfileCvImportModal
          v-if="cvImportOpen"
          v-model:open="cvImportOpen"
          :profile="profile"
          :refresh-profile="refreshCvProfile"
          @saved="onSaved"
        />
        <ProfileBasicsModal
          v-model:open="basicsOpen"
          :profile="profile"
          @saved="onSaved"
          @changed="refresh"
        />
        <ProfileSummaryModal
          v-model:open="summaryOpen"
          :profile="profile"
          @saved="onSaved"
          @changed="refresh"
        />
        <ProfileHobbiesModal
          v-model:open="hobbiesOpen"
          :profile="profile"
          @saved="onSaved"
          @changed="refresh"
        />
        <ProfileAddressModal
          v-model:open="addressOpen"
          :profile="profile"
          @saved="onSaved"
          @changed="refresh"
        />
        <ProfileStoryModal
          v-model:open="storyOpen"
          :profile="profile"
          @saved="onSaved"
          @changed="refresh"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { createReusableTemplate, useMediaQuery } from '@vueuse/core'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { LINK_KIND_OPTIONS } from '~/constants/listing'
import type { Language } from '~/constants/listing'
import type { DropdownMenuItem } from '@nuxt/ui'
import { PROFILE, type ProfileBullet, type ProfileData } from '~/composables/useProfile'
import type { ProfileSectionName } from '~/components/profile/ClearSectionsModal.vue'
import { STORY_FIELDS } from '~/constants/profileStory'

definePageMeta({ title: 'Profile' })

const { profile, loading, error, refresh } = useProfile()

// Same layout as the tailored CV: one column, and from 2xl long-text cards in the main column with
// the language strip and short lists beside them.
const twoColumns = useMediaQuery('(min-width: 1536px)')
const [DefineSettings, SettingsCard] = createReusableTemplate()
const [DefineContact, ContactCard] = createReusableTemplate()
const [DefineSummary, SummaryCard] = createReusableTemplate()
const [DefineExperience, ExperienceCard] = createReusableTemplate()
const [DefineSkills, SkillsCard] = createReusableTemplate()
const [DefineEducation, EducationCard] = createReusableTemplate()
const [DefineCertifications, CertificationsCard] = createReusableTemplate()
const [DefineProjects, ProjectsCard] = createReusableTemplate()
const [DefineLanguages, LanguagesCard] = createReusableTemplate()
const [DefineHobbies, HobbiesCard] = createReusableTemplate()
const [DefineReferences, ReferencesCard] = createReusableTemplate()

const basicsOpen = ref(false)
const summaryOpen = ref(false)
const hobbiesOpen = ref(false)
const storyOpen = ref(false)
const addressOpen = ref(false)
const cvImportOpen = ref(false)
const translateAiOpen = ref(false)
const refineOpen = ref(false)
const refineOpened = useOpenedOnce(refineOpen)
const cvImportOpened = useOpenedOnce(cvImportOpen)
const translateAiOpened = useOpenedOnce(translateAiOpen)
const clearTarget = ref<ProfileSectionName | 'ALL' | null>(null)

const isProfileEmpty = computed(() => {
  const p = profile.value
  if (!p) return true
  return (
    !p.fullName &&
    !p.headline &&
    !p.summary &&
    !p.experiences.length &&
    !p.educations.length &&
    !p.projects.length &&
    !p.skills.length &&
    !p.languages.length &&
    !p.certifications.length &&
    !p.references.length &&
    !p.hobbies.length
  )
})

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

const target = computed(() => translationTarget(profile.value?.contentLanguage))
// en-GB for English: day-month order and 24-hour habits match a Norwegian reader.
const locale = computed(() => (profile.value?.contentLanguage === 'ENGLISH' ? 'en-GB' : 'nb-NO'))

// The translated view lives in the URL (?lang=norwegian), so it is one click, survives a reload
// and can be linked to. `replace`, so switching views doesn't fill the back history.
const route = useRoute()
const router = useRouter()
const translating = computed({
  // An empty profile has no language strip to switch back with, so it is always the written view.
  get: () => !isProfileEmpty.value && route.query.lang === target.value.toLowerCase(),
  set: (on: boolean) => {
    if (on === translating.value) return
    router.replace({ query: { ...route.query, lang: on ? target.value.toLowerCase() : undefined } })
  }
})

// In the order the sections are shown.
const bulletsOf = (p: ProfileData) => [
  ...p.experiences.flatMap((e) => e.bullets),
  ...p.projects.flatMap((e) => e.bullets),
  ...p.educations.flatMap((e) => e.bullets),
  ...p.certifications.flatMap((e) => e.bullets)
]

// Everything that can be translated one by one, in page order: an entry's title before its
// bullets. Education counts once for its degree and field, and only when it has either.
const translatableItems = (p: ProfileData) => {
  const translated = (translations: readonly { language: Language }[]) =>
    translations.some((t) => t.language === target.value)
  const bullets = (list: readonly ProfileBullet[]) =>
    list.map((b) => ({ key: translationKey('bullet', b.id), done: translated(b.translations) }))
  return [
    ...p.experiences.flatMap((e) => [
      { key: translationKey('experience', e.id), done: translated(e.translations) },
      ...bullets(e.bullets)
    ]),
    ...p.projects.flatMap((e) => bullets(e.bullets)),
    ...p.educations.flatMap((e) => [
      ...(e.degree || e.field
        ? [{ key: translationKey('education', e.id), done: translated(e.translations) }]
        : []),
      ...bullets(e.bullets)
    ]),
    ...p.certifications.flatMap((e) => bullets(e.bullets))
  ]
}

// Saving one translation opens the next one still missing, so translating is a run of Enter
// presses down the page.
const editingKey = ref<string | null>(null)
watch(translating, () => (editingKey.value = null))
const nextUntranslated = (key: string) => {
  const items = profile.value ? translatableItems(profile.value) : []
  const after = items.findIndex((i) => i.key === key)
  return items.slice(after + 1).find((i) => !i.done)?.key ?? null
}
provideProfileTranslation({ translating, target, locale, editingKey, nextUntranslated })
const hasTranslations = computed(
  () =>
    !!profile.value &&
    (profile.value.translations.length > 0 ||
      profile.value.experiences.some((e) => e.translations.length > 0) ||
      profile.value.educations.some((e) => e.translations.length > 0) ||
      bulletsOf(profile.value).some((b) => b.translations.length > 0))
)
const translateProgress = computed(() => {
  const items = profile.value ? translatableItems(profile.value) : []
  return { done: items.filter((i) => i.done).length, total: items.length }
})
const staleCount = computed(() => {
  const p = profile.value
  if (!p) return 0
  return (
    p.translations.filter((t) => t.isHeadlineStale || t.isSummaryStale).length +
    p.experiences.filter((e) => e.translations.some((t) => t.isStale)).length +
    p.educations.filter((e) => e.translations.some((t) => t.isDegreeStale || t.isFieldStale))
      .length +
    bulletsOf(p).filter((b) => b.translations.some((t) => t.isStale)).length
  )
})

const { run: runLanguage, loading: languageLoading } = useMutation(() => refresh())
const changeContentLanguage = async (language: Language) => {
  if (language === profile.value?.contentLanguage) return
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

// Grouped, so the destructive item sits apart from the rest.
const profileMenu = computed<DropdownMenuItem[][]>(() =>
  [
    [
      ...(importAvailable.value
        ? [
            {
              label: 'Import CV',
              icon: 'i-lucide-clipboard-paste',
              onSelect: () => (cvImportOpen.value = true)
            }
          ]
        : []),
      ...(hasBullets.value
        ? [
            {
              label: 'Refine bullets with AI',
              icon: 'i-lucide-sparkles',
              onSelect: () => (refineOpen.value = true)
            }
          ]
        : [])
    ],
    hasCvContent.value
      ? [
          {
            label: 'Clear CV content…',
            icon: 'i-lucide-eraser',
            color: 'error' as const,
            onSelect: () => (clearTarget.value = 'ALL')
          }
        ]
      : []
  ].filter((group) => group.length)
)

const hasBullets = computed(() => !!profile.value && profileBullets(profile.value).size > 0)
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
const hasContact = computed(
  () =>
    !!(profile.value?.fullName || profile.value?.headline) ||
    contact.value.length > 0 ||
    !!profile.value?.links.length
)
</script>

<template>
  <div class="flex justify-center">
    <div class="w-full min-w-0 max-w-3xl space-y-4 sm:space-y-6 2xl:max-w-none">
      <div class="flex items-start justify-between gap-3" data-testid="profile-header">
        <div class="min-w-0">
          <h1 class="text-xl font-semibold text-highlighted">CV profile</h1>
          <p class="text-sm text-muted">Tailored CVs and cover letters start from this.</p>
        </div>
        <!-- Import and refine rewrite the written text, so they wait for its view. -->
        <UDropdownMenu
          v-if="profile && !translating && profileMenu.length"
          :items="profileMenu"
          :content="{ align: 'end' }"
        >
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
            aria-label="More profile actions"
            data-testid="profile-menu"
          />
        </UDropdownMenu>
      </div>

      <UAlert v-if="error" color="error" :description="ERROR_MESSAGES.generic" />

      <!-- Only on first load: refreshes after an edit keep the page (and its modals) mounted. -->
      <div v-else-if="loading && !profile" class="space-y-4" data-testid="profile-loading">
        <USkeleton class="h-24 w-full" />
        <USkeleton class="h-32 w-full" />
        <USkeleton class="h-64 w-full" />
      </div>

      <template v-else-if="profile">
        <DefineSettings>
          <ProfileSettings
            v-if="!isProfileEmpty"
            v-model:translating="translating"
            :content-language="profile.contentLanguage"
            :target="target"
            :progress="translateProgress"
            :stale-count="staleCount"
            :has-translations="hasTranslations"
            :loading="languageLoading"
            @change-language="changeContentLanguage"
            @translate-ai="translateAiOpen = true"
          />
        </DefineSettings>

        <DefineContact>
          <ProfileSection
            title="Contact and headline"
            icon="i-lucide-user-round"
            testid="profile-contact"
            :empty="!hasContact"
            empty-message="No name or contact details yet."
            add-label="Add details"
            @add="basicsOpen = true"
          >
            <template v-if="hasContact" #actions>
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="subtle"
                size="sm"
                aria-label="Edit contact and headline"
                data-testid="profile-edit"
                @click="basicsOpen = true"
                >Edit</UButton
              >
            </template>
            <div class="space-y-2 break-words text-sm">
              <div>
                <p class="font-medium text-highlighted" data-testid="profile-name">
                  {{ profile.fullName ?? 'No name yet' }}
                </p>
                <p v-if="profile.headline">{{ profile.headline }}</p>
              </div>
              <ul v-if="contact.length" class="flex flex-wrap gap-x-6 gap-y-1">
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
              <div v-if="profile.links.length" class="flex flex-wrap gap-2">
                <UButton
                  v-for="link in profile.links"
                  :key="link.url"
                  :to="link.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  :icon="kindOf(link.kind).icon"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  data-testid="profile-link"
                  >{{ link.label || kindOf(link.kind).label }}</UButton
                >
              </div>
            </div>
          </ProfileSection>
        </DefineContact>

        <DefineSummary>
          <!-- Open in the translated view even without a summary: the headline translation is here. -->
          <ProfileSection
            title="Summary"
            icon="i-lucide-notebook-pen"
            testid="profile-summary"
            clearable
            :empty="!profile.summary && !translating"
            empty-message="No summary yet."
            add-label="Add summary"
            @add="summaryOpen = true"
            @clear="clearTarget = 'SUMMARY'"
          >
            <template v-if="profile.summary" #actions>
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="subtle"
                size="sm"
                aria-label="Edit summary"
                data-testid="profile-summary-edit"
                @click="summaryOpen = true"
                >Edit</UButton
              >
            </template>
            <LazyAppMarkdownContent v-if="profile.summary" :source="profile.summary" />
            <ProfileTranslationBlock
              v-if="translating"
              :profile="profile"
              :class="{ 'mt-3': profile.summary }"
              @changed="refresh"
            />
          </ProfileSection>
        </DefineSummary>

        <DefineExperience>
          <ProfileExperienceList
            :experiences="profile.experiences"
            :count="profile.experiences.length"
            @changed="refresh"
            @clear="clearTarget = 'EXPERIENCES'"
          />
        </DefineExperience>

        <DefineSkills>
          <ProfileSkillList
            :skills="profile.skills"
            :profile="profile"
            :count="profile.skills.length"
            @changed="refresh"
            @clear="clearTarget = 'SKILLS'"
          />
        </DefineSkills>

        <DefineEducation>
          <ProfileEducationList
            :educations="profile.educations"
            :count="profile.educations.length"
            @changed="refresh"
            @clear="clearTarget = 'EDUCATIONS'"
          />
        </DefineEducation>

        <DefineCertifications>
          <ProfileCertificationList
            :certifications="profile.certifications"
            :count="profile.certifications.length"
            @changed="refresh"
            @clear="clearTarget = 'CERTIFICATIONS'"
          />
        </DefineCertifications>

        <DefineProjects>
          <ProfileProjectList
            :projects="profile.projects"
            :count="profile.projects.length"
            @changed="refresh"
            @clear="clearTarget = 'PROJECTS'"
          />
        </DefineProjects>

        <DefineLanguages>
          <ProfileLanguageList
            :languages="profile.languages"
            :count="profile.languages.length"
            @changed="refresh"
            @clear="clearTarget = 'LANGUAGES'"
          />
        </DefineLanguages>

        <DefineHobbies>
          <ProfileSection
            title="Hobbies"
            icon="i-lucide-palette"
            testid="profile-hobbies"
            clearable
            :count="profile.hobbies.length"
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
                variant="subtle"
                size="sm"
                aria-label="Edit hobbies"
                data-testid="profile-hobbies-edit"
                @click="hobbiesOpen = true"
                >Edit</UButton
              >
            </template>
            <div class="flex flex-wrap gap-2">
              <UBadge v-for="h in profile.hobbies" :key="h" color="neutral" variant="subtle">{{
                h
              }}</UBadge>
            </div>
          </ProfileSection>
        </DefineHobbies>

        <DefineReferences>
          <ProfileReferenceList
            :references="profile.references"
            :count="profile.references.length"
            @changed="refresh"
            @clear="clearTarget = 'REFERENCES'"
          />
        </DefineReferences>

        <UCard v-if="isProfileEmpty" data-testid="profile-onboarding">
          <div class="flex flex-col items-center gap-3 py-4 text-center">
            <UIcon name="i-lucide-user-round" class="size-10 text-muted" />
            <h2 class="text-lg font-semibold">Start building your profile</h2>
            <p class="text-sm text-muted">Import an existing CV or add sections one by one.</p>
            <div class="flex items-center gap-3">
              <UButton
                icon="i-lucide-clipboard-paste"
                :disabled="!importAvailable"
                data-testid="profile-onboarding-import"
                @click="cvImportOpen = true"
                >Import CV</UButton
              >
              <UButton
                variant="link"
                data-testid="profile-onboarding-manual"
                @click="summaryOpen = true"
                >or add sections manually</UButton
              >
            </div>
          </div>
        </UCard>

        <!-- The DOM follows what's on screen, so tab order walks the page in reading order. Crossing
           1536px remounts the cards (and closes an open form), as in CvContentEditor. -->
        <div
          v-if="twoColumns"
          class="grid grid-cols-[minmax(0,1fr)_26rem] items-start gap-6 min-[120rem]:grid-cols-[minmax(0,1fr)_30rem]"
          data-testid="profile-columns"
        >
          <div class="min-w-0 space-y-6">
            <ContactCard />
            <SummaryCard />
            <ExperienceCard />
            <ProjectsCard />
            <ReferencesCard />
          </div>
          <div class="min-w-0 space-y-6">
            <SettingsCard />
            <SkillsCard />
            <EducationCard />
            <CertificationsCard />
            <LanguagesCard />
            <HobbiesCard />
          </div>
        </div>
        <template v-else>
          <SettingsCard />
          <ContactCard />
          <SummaryCard />
          <ExperienceCard />
          <SkillsCard />
          <EducationCard />
          <CertificationsCard />
          <ProjectsCard />
          <LanguagesCard />
          <HobbiesCard />
          <ReferencesCard />
        </template>

        <!-- Untranslated, so only in the written view. -->
        <section
          v-if="!translating"
          id="profile-off-cv"
          class="space-y-4 border-t border-default pt-6 sm:space-y-6"
          data-testid="profile-off-cv"
        >
          <div>
            <h2 class="font-semibold text-highlighted">Not on your CV</h2>
            <p class="text-sm text-muted">
              Job preferences, and the address, story and writing samples cover letters use.
            </p>
          </div>

          <div class="grid items-start gap-4 sm:gap-6 2xl:grid-cols-2">
            <ProfilePreferencesCard :profile="profile" @saved="onSaved" @changed="refresh" />

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
                  variant="subtle"
                  size="sm"
                  aria-label="Edit address"
                  data-testid="profile-address-edit"
                  @click="addressOpen = true"
                  >Edit</UButton
                >
              </template>
              <div class="space-y-1 text-sm">
                <p v-if="profile.streetAddress" class="break-words">{{ profile.streetAddress }}</p>
                <p>{{ postalLine }}</p>
                <p v-if="!profile.location?.city" class="text-muted">
                  Add your town under Contact and headline.
                </p>
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
                  variant="subtle"
                  size="sm"
                  aria-label="Edit story"
                  data-testid="profile-story-edit"
                  @click="storyOpen = true"
                  >Edit</UButton
                >
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

            <ProfileWritingSampleList id="writing-samples" class="scroll-mt-4" />
          </div>
        </section>

        <ProfileClearSectionsModal
          v-model:target="clearTarget"
          :profile="profile"
          @saved="onSaved"
          @changed="refresh"
        />
        <LazyProfileCvImportModal
          v-if="cvImportOpened"
          v-model:open="cvImportOpen"
          :profile="profile"
          :refresh-profile="refreshCvProfile"
          @saved="onSaved"
        />
        <LazyProfileBulletRefinementModal
          v-if="refineOpened"
          v-model:open="refineOpen"
          :profile="profile"
          @changed="refresh"
        />
        <LazyProfileTranslationAiModal
          v-if="translateAiOpened"
          v-model:open="translateAiOpen"
          :profile="profile"
          @changed="refresh"
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

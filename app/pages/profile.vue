<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { LINK_KIND_OPTIONS } from '~/constants/listing'
import { LANGUAGE_OPTIONS, type Language } from '~/constants/listing'
import type { DropdownMenuItem } from '@nuxt/ui'
import { PROFILE, type ProfileBullet, type ProfileData } from '~/composables/useProfile'
import type { ProfileSectionName } from '~/components/profile/ClearSectionsModal.vue'
import { STORY_FIELDS } from '~/constants/profileStory'

definePageMeta({ title: 'Profile' })

const { profile, loading, error, refresh } = useProfile()
const isTabletOrAbove = useMediaQuery('(min-width: 768px)')
const isMobileCollapsible = computed(() => !isTabletOrAbove.value)
provide('profile-mobile-collapsible', isMobileCollapsible)

const JUMP_LINKS = [
  { id: 'profile-summary', label: 'Summary', icon: 'i-lucide-notebook-pen' },
  { id: 'profile-experience', label: 'Experience', icon: 'i-lucide-briefcase' },
  { id: 'profile-skills', label: 'Skills', icon: 'i-lucide-wrench' },
  { id: 'profile-projects', label: 'Projects', icon: 'i-lucide-folder-git-2' },
  { id: 'profile-education', label: 'Education', icon: 'i-lucide-graduation-cap' },
  { id: 'profile-cover-letter', label: 'Cover letter material', icon: 'i-lucide-file-pen-line' }
]
const jumpTarget = ref<string | null>(null)
provide('profile-jump-target', jumpTarget)
// The page scrolls inside the layout, and a collapsed section must open before it is scrolled to.
const jumpTo = async (id: string) => {
  jumpTarget.value = id
  await nextTick()
  jumpTarget.value = null
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

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

const showMinorSections = ref(false)
const shouldHideMinorSections = computed(() => {
  const p = profile.value
  if (!p) return false
  const filledCoreCount = [
    p.summary,
    p.experiences.length,
    p.educations.length,
    p.skills.length,
    p.languages.length
  ].filter(Boolean).length
  return filledCoreCount <= 2 && !showMinorSections.value
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

const translating = ref(false)
useToastClearance(useTemplateRef('translating-bar'))
const target = computed(() => translationTarget(profile.value?.contentLanguage))
// en-GB for English: day-month order and 24-hour habits match a Norwegian reader.
const locale = computed(() => (profile.value?.contentLanguage === 'ENGLISH' ? 'en-GB' : 'nb-NO'))
const targetLabel = computed(() => LANGUAGE_OPTIONS.find((o) => o.value === target.value)!.label)

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
// Progress for the translating bar: how many items have a translation in the target language.
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
const untranslatedCount = computed(() => {
  if (!profile.value) return 0
  const items = translatableItems(profile.value)
  return items.filter((i) => !i.done).length
})
const translationPrompt = computed(() =>
  [
    untranslatedCount.value &&
      `${untranslatedCount.value} item${untranslatedCount.value === 1 ? '' : 's'} untranslated`,
    staleCount.value &&
      `${staleCount.value} translation${staleCount.value === 1 ? '' : 's'} outdated`
  ]
    .filter(Boolean)
    .join(' · ')
)
const contentLanguageLabel = computed(() => {
  const language = profile.value?.contentLanguage
  return LANGUAGE_OPTIONS.find((o) => o.value === language)?.label ?? language
})

const profileMenu = computed<DropdownMenuItem[]>(() => [
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
          label: 'Refine bullets',
          icon: 'i-lucide-sparkles',
          onSelect: () => (refineOpen.value = true)
        }
      ]
    : []),
  ...(!translating.value
    ? [
        {
          label: `Translate to ${targetLabel.value}`,
          icon: 'i-lucide-languages',
          onSelect: () => (translating.value = true)
        },
        {
          label: 'Translate with AI',
          icon: 'i-lucide-sparkles',
          onSelect: () => (translateAiOpen.value = true)
        }
      ]
    : []),
  ...(hasCvContent.value
    ? [
        {
          label: 'Clear CV content…',
          icon: 'i-lucide-eraser',
          color: 'error' as const,
          onSelect: () => (clearTarget.value = 'ALL')
        }
      ]
    : [])
])

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
</script>

<template>
  <div class="flex justify-center">
    <div class="w-full min-w-0 max-w-3xl space-y-4 sm:space-y-6 lg:max-w-6xl 2xl:max-w-[1400px]">
      <UAlert v-if="error" color="error" :description="ERROR_MESSAGES.generic" />

      <!-- Only on first load: refreshes after an edit keep the page (and its modals) mounted. -->
      <div v-else-if="loading && !profile" class="space-y-4" data-testid="profile-loading">
        <USkeleton class="h-24 w-full" />
        <div class="grid gap-4 lg:grid-cols-3 2xl:grid-cols-4">
          <USkeleton class="h-64 w-full lg:col-span-2 2xl:col-span-3" />
          <div class="space-y-4">
            <USkeleton class="h-32 w-full" />
            <USkeleton class="h-40 w-full" />
          </div>
        </div>
      </div>

      <template v-else-if="profile">
        <header class="space-y-3" data-testid="profile-header">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h1 class="break-words text-xl font-semibold text-highlighted">
                {{ profile.fullName ?? 'Your profile' }}
              </h1>
              <p v-if="profile.headline" class="text-muted">{{ profile.headline }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="subtle"
                data-testid="profile-edit"
                @click="basicsOpen = true"
                >Edit details</UButton
              >
              <UDropdownMenu
                v-if="profileMenu.length"
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
          </div>

          <div
            v-if="contact.length || profile.links.length"
            class="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm"
          >
            <span
              v-for="row in contact"
              :key="row.icon"
              class="flex items-center gap-2"
              :data-testid="row.testid"
            >
              <UIcon :name="row.icon" class="size-4 shrink-0 text-muted" />
              <span class="break-all">{{ row.text }}</span>
            </span>
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
        </header>

        <nav
          v-if="!isProfileEmpty"
          aria-labelledby="profile-jump-heading"
          class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
          data-testid="profile-jump"
        >
          <h2 id="profile-jump-heading" class="shrink-0 text-sm font-medium text-muted">
            Jump to section
          </h2>
          <ul class="flex flex-wrap gap-2">
            <li v-for="link in JUMP_LINKS" :key="link.id">
              <UButton
                :href="`#${link.id}`"
                :icon="link.icon"
                color="neutral"
                variant="outline"
                @click.prevent="jumpTo(link.id)"
                >{{ link.label }}</UButton
              >
            </li>
          </ul>
        </nav>

        <div
          class="flex flex-wrap items-center gap-2 text-sm"
          data-testid="profile-translation-controls"
        >
          <UBadge color="neutral" variant="subtle" class="gap-1.5">
            <UIcon name="i-lucide-languages" class="size-3.5" />
            {{ contentLanguageLabel }}
          </UBadge>
          <USelect
            :model-value="profile.contentLanguage"
            :items="[...LANGUAGE_OPTIONS]"
            :disabled="hasTranslations || languageLoading"
            aria-label="Content language"
            size="xs"
            class="w-32"
            data-testid="profile-content-language"
            @update:model-value="changeContentLanguage"
          />
          <span
            v-if="hasTranslations"
            class="text-xs text-muted"
            data-testid="profile-content-language-hint"
            >Delete all translations before changing the content language.</span
          >
        </div>

        <p
          v-if="!translating && translationPrompt"
          class="text-sm text-muted"
          data-testid="profile-untranslated-prompt"
        >
          {{ translationPrompt }} ·
          <UButton
            variant="link"
            size="xs"
            class="align-baseline"
            data-testid="profile-translate-ai"
            @click="translateAiOpen = true"
            >Translate with AI</UButton
          >
        </p>

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

        <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-3 2xl:grid-cols-4">
          <div class="space-y-4 lg:col-span-2 2xl:col-span-3">
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
              :count="profile.experiences.length"
              @changed="refresh"
              @clear="clearTarget = 'EXPERIENCES'"
            />

            <!-- Mobile: Skills right after Experience for scannability -->
            <ProfileSkillList
              v-if="!isTabletOrAbove"
              :skills="profile.skills"
              :profile="profile"
              :default-open="false"
              :count="profile.skills.length"
              @changed="refresh"
              @clear="clearTarget = 'SKILLS'"
            />

            <ProfileProjectList
              :projects="profile.projects"
              :default-open="false"
              :count="profile.projects.length"
              @changed="refresh"
              @clear="clearTarget = 'PROJECTS'"
            />

            <ProfileEducationList
              :educations="profile.educations"
              :default-open="false"
              :count="profile.educations.length"
              @changed="refresh"
              @clear="clearTarget = 'EDUCATIONS'"
            />

            <ProfileReferenceList
              v-if="profile.references.length || !shouldHideMinorSections"
              :references="profile.references"
              :default-open="false"
              :count="profile.references.length"
              @changed="refresh"
              @clear="clearTarget = 'REFERENCES'"
            />
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-1">
            <ProfileSkillList
              v-if="isTabletOrAbove"
              :skills="profile.skills"
              :profile="profile"
              :default-open="false"
              :count="profile.skills.length"
              @changed="refresh"
              @clear="clearTarget = 'SKILLS'"
            />

            <ProfileLanguageList
              :languages="profile.languages"
              :default-open="false"
              :count="profile.languages.length"
              @changed="refresh"
              @clear="clearTarget = 'LANGUAGES'"
            />

            <ProfileSection
              v-if="profile.hobbies.length || !shouldHideMinorSections"
              title="Hobbies"
              icon="i-lucide-palette"
              testid="profile-hobbies"
              clearable
              :default-open="false"
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
              :default-open="false"
              :count="profile.certifications.length"
              @changed="refresh"
              @clear="clearTarget = 'CERTIFICATIONS'"
            />

            <ProfilePreferencesCard
              v-if="profile.jobRoles.length || profile.workModes.length || !shouldHideMinorSections"
              :profile="profile"
              :default-open="false"
              @saved="onSaved"
              @changed="refresh"
            />

            <UButton
              v-if="shouldHideMinorSections"
              icon="i-lucide-plus"
              color="neutral"
              variant="outline"
              block
              class="self-start"
              data-testid="profile-add-more-sections"
              @click="showMinorSections = true"
              >Add more sections</UButton
            >
          </div>
        </div>

        <section
          id="profile-cover-letter"
          class="scroll-mt-4 space-y-4 border-t border-default pt-6"
          data-testid="profile-cover-letter-zone"
        >
          <div>
            <h2 class="font-semibold">Cover letter material</h2>
            <p class="text-sm text-muted">
              Address, story and writing samples used only for cover letters.
            </p>
          </div>

          <ProfileSection
            title="Address"
            icon="i-lucide-map-pin"
            testid="profile-address"
            :default-open="false"
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
            :default-open="false"
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

          <ProfileWritingSampleList id="writing-samples" class="scroll-mt-4" />
        </section>

        <!-- Sticky so Done stays in reach on a long profile; same bar style as the tailored CV editor. -->
        <div
          v-if="translating"
          ref="translating-bar"
          class="sticky bottom-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-default bg-default/90 p-3 backdrop-blur"
          data-testid="profile-translating-bar"
        >
          <UIcon name="i-lucide-languages" class="size-5 shrink-0 text-primary" />
          <div class="min-w-0 flex-1 text-sm">
            <p class="font-medium text-highlighted">
              Translating to {{ targetLabel }}
              <span class="font-normal text-muted" data-testid="profile-translating-progress"
                >· {{ translateProgress.done }} of {{ translateProgress.total }} translated</span
              >
            </p>
            <p class="text-muted">
              Summary, job titles, education and bullets. Names, dates and other sections are used
              as written.
            </p>
          </div>
          <UButton
            icon="i-lucide-sparkles"
            color="neutral"
            variant="outline"
            data-testid="profile-translating-ai"
            @click="translateAiOpen = true"
            >Translate with AI</UButton
          >
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

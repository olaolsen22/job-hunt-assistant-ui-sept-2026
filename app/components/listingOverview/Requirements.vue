<script setup lang="ts">
import type { ListingOverview } from '~/composables/useListingOverview'
import { languageLabel } from '~/constants/listing'
import type { SavedRequirementMap } from '~/composables/useRequirementMap'
import {
  REQUIREMENT_IMPORTANCE,
  REQUIREMENT_KINDS,
  REQUIREMENT_MATCHES,
  type RequirementNeed
} from '~/utils/requirementMap'

const { listing, map, pending, failed } = defineProps<{
  listing: Pick<ListingOverview, 'skills' | 'languages' | 'analyzedAt' | 'updatedAt'>
  map: SavedRequirementMap | null | undefined
  pending: boolean
  failed: boolean
}>()

const MATCH_ORDER = { GAP: 0, PARTIAL: 1, EVIDENCED: 2 } as const
const MATCH_COLOR = { GAP: 'error', PARTIAL: 'warning', EVIDENCED: 'success' } as const
const match = (need: RequirementNeed) => REQUIREMENT_MATCHES.find((m) => m.value === need.match)!

const needs = computed(() => map?.content.needs ?? [])

// Required before Preferred; gaps first inside each group so what's missing is seen first.
const groups = computed(() =>
  REQUIREMENT_IMPORTANCE.map((importance) => {
    const items = needs.value
      .filter((n) => n.importance === importance.value)
      .toSorted((a, b) => MATCH_ORDER[a.match] - MATCH_ORDER[b.match])
    const counts = matchCounts(items)
    const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
    const summary = [
      counts.GAP && plural(counts.GAP, 'gap', 'gaps'),
      counts.PARTIAL && `${counts.PARTIAL} partial`,
      counts.EVIDENCED && `${counts.EVIDENCED} evidenced`
    ]
      .filter(Boolean)
      .join(', ')
    return { key: importance.value, label: importance.label, items, summary }
  }).filter((group) => group.items.length)
)

const stale = computed(() => !!map && requirementMapStale(map.updatedAt, listing.updatedAt))

const skills = computed(() =>
  listing.skills.toSorted((a, b) => Number(b.isRequired) - Number(a.isRequired))
)
const languages = computed(() =>
  listing.languages.toSorted((a, b) => Number(b.isRequired) - Number(a.isRequired))
)
const skillLine = (skill: ListingOverview['skills'][number]) =>
  [
    skill.skill.name,
    `Level ${skill.level} of 5`,
    skill.minYears ? `${skill.minYears}+ years` : undefined,
    skill.isRequired ? 'Must-have' : 'Nice-to-have'
  ]
    .filter(Boolean)
    .join(' · ')
const languageLine = (lang: ListingOverview['languages'][number]) =>
  [languageLabel(lang.language), lang.level, lang.isRequired ? 'Must-have' : 'Nice-to-have']
    .filter(Boolean)
    .join(' · ')
</script>

<template>
  <AppCard title="Requirements" data-testid="overview-requirements">
    <div v-if="pending" class="space-y-3" data-testid="requirements-loading">
      <USkeleton class="h-5 w-2/3" />
      <USkeleton class="h-5 w-1/2" />
      <USkeleton class="h-5 w-3/5" />
    </div>

    <div v-else-if="groups.length" class="space-y-6">
      <p v-if="stale" class="text-sm text-muted" data-testid="requirements-stale">
        The listing changed after this map was saved, so it may be out of date.
      </p>
      <section v-for="group in groups" :key="group.key" class="space-y-3">
        <h3 class="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
          {{ group.label }}
          <span class="font-normal text-muted" :data-testid="`requirements-summary-${group.key}`">{{
            group.summary
          }}</span>
        </h3>
        <ul class="max-w-prose space-y-3">
          <li
            v-for="(need, index) in group.items"
            :key="index"
            class="space-y-1"
            data-testid="requirement-need"
          >
            <div class="flex flex-wrap items-center gap-2">
              <UBadge
                :color="MATCH_COLOR[need.match]"
                variant="subtle"
                :icon="match(need).icon"
                data-testid="requirement-match"
                >{{ match(need).label }}</UBadge
              >
              <span class="text-xs text-muted">{{
                optionLabel(REQUIREMENT_KINDS, need.kind)
              }}</span>
            </div>
            <p class="text-sm wrap-break-word">{{ need.text }}</p>
            <p v-if="need.note" class="text-sm wrap-break-word text-muted">{{ need.note }}</p>
          </li>
        </ul>
      </section>
    </div>

    <div v-else-if="skills.length || languages.length" class="space-y-4">
      <p class="text-sm text-muted" data-testid="requirements-no-map">
        {{
          failed
            ? "Couldn't load the requirement map, so this is the ad's skill list."
            : "No requirement map saved yet, so this is the ad's skill list."
        }}
      </p>
      <section v-if="skills.length" class="space-y-2">
        <h3 class="text-sm font-semibold">Skills</h3>
        <ul class="space-y-1 text-sm">
          <li v-for="skill in skills" :key="skill.skill.id" data-testid="requirements-skill">
            {{ skillLine(skill) }}
          </li>
        </ul>
      </section>
      <section v-if="languages.length" class="space-y-2">
        <h3 class="text-sm font-semibold">Languages</h3>
        <ul class="space-y-1 text-sm">
          <li v-for="lang in languages" :key="lang.language" data-testid="requirements-language">
            {{ languageLine(lang) }}
          </li>
        </ul>
      </section>
    </div>

    <div
      v-else
      class="flex flex-col items-center gap-2 py-6 text-center text-muted"
      data-testid="requirements-empty"
    >
      <UIcon name="i-lucide-list-checks" class="size-8" />
      <p class="text-sm">
        {{
          failed
            ? "Couldn't load the requirement map."
            : listing.analyzedAt
              ? 'No requirements found in this ad.'
              : 'No requirements extracted yet.'
        }}
      </p>
    </div>
  </AppCard>
</template>

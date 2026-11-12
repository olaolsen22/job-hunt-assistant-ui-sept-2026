<script setup lang="ts">
import type { ListingOverview } from '~/composables/useListingOverview'
import { companyKindLabel, companySizeRange } from '~/constants/company'

const { company } = defineProps<{ company: ListingOverview['company'] }>()

const facts = computed(() =>
  [
    { label: 'Industry', value: company.industry?.name },
    { label: 'Type', value: companyKindLabel(company.kind) },
    {
      label: 'Size',
      value: company.sizeBand ? `${companySizeRange(company.sizeBand)} employees` : undefined
    },
    { label: 'Founded', value: company.foundedYear?.toString() },
    {
      label: 'Org number',
      value: company.orgNumber ? formatOrgNumber(company.orgNumber) : undefined
    }
  ].filter((fact) => fact.value)
)

const links = computed(() =>
  [
    { label: 'Website', icon: 'i-lucide-globe', to: company.websiteUrl },
    { label: 'Careers', icon: 'i-lucide-briefcase', to: company.careersUrl },
    { label: 'LinkedIn', icon: 'i-lucide-linkedin', to: company.linkedInUrl }
  ].filter((link) => link.to)
)
</script>

<template>
  <div class="space-y-4" data-testid="overview-company">
    <div class="space-y-1">
      <ULink :to="`/companies/${company.id}`" class="font-semibold text-highlighted">{{
        company.name
      }}</ULink>
      <p class="text-sm text-muted">
        {{ company.listingCount }} {{ company.listingCount === 1 ? 'listing' : 'listings' }} ·
        {{ company.applicationCount }}
        {{ company.applicationCount === 1 ? 'application' : 'applications' }}
      </p>
    </div>

    <dl v-if="facts.length" class="grid grid-cols-2 gap-x-6 gap-y-3">
      <div v-for="fact in facts" :key="fact.label">
        <dt class="text-xs text-muted">{{ fact.label }}</dt>
        <dd class="text-sm font-medium">{{ fact.value }}</dd>
      </div>
    </dl>

    <div v-if="company.description" class="max-w-prose text-sm">
      <LazyAppMarkdownContent :source="company.description" />
    </div>

    <div v-if="links.length" class="flex flex-wrap gap-x-4 gap-y-2">
      <ULink
        v-for="link in links"
        :key="link.label"
        :to="link.to!"
        target="_blank"
        class="inline-flex items-center gap-1.5 text-sm"
      >
        <UIcon :name="link.icon" class="size-4 shrink-0" />{{ link.label }}
      </ULink>
    </div>
  </div>
</template>

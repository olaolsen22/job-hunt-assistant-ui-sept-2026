<script setup lang="ts">
import { SUCCESS_TOAST_DURATION } from '~/constants/ui'
import type { FormError } from '@nuxt/ui'
import type { ListingLocation } from '~/composables/useListingForm'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import {
  COMPANY_KIND_OPTIONS,
  COMPANY_SIZE_OPTIONS,
  DESCRIPTION_MAX,
  FOUNDED_MIN,
  type CompanyKind,
  type CompanySize
} from '~/constants/company'
import {
  LANGUAGE_OPTIONS,
  WORK_MODE_OPTIONS,
  type Language,
  type WorkMode
} from '~/constants/listing'

definePageMeta({ title: 'Edit company' })

const COMPANY = graphql(`
  query CompanyForEdit($id: Int!) {
    companies(where: { id: { eq: $id } }, first: 1) {
      nodes {
        id
        name
        industry {
          name
        }
        locations {
          location {
            city
            countryCode
          }
        }
        orgNumber
        websiteUrl
        careersUrl
        linkedInUrl
        kind
        sizeBand
        foundedYear
        description
        workMode
        workingLanguage
        skills {
          skill {
            name
          }
        }
      }
    }
  }
`)

// Both in one request (mutations run in order). Each is a full replace, so the whole form is sent.
const UPDATE_COMPANY = graphql(`
  mutation UpdateCompany($input: UpdateCompanyInput!, $details: UpdateCompanyDetailsInput!) {
    updateCompany(input: $input) {
      company {
        id
      }
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
    updateCompanyDetails(input: $details) {
      company {
        id
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

const route = useRoute()
const router = useRouter()
const id = Number(route.params.id)

// Client-only (`server: false`) since it needs the session cookie.
const { data, status, error } = await useAsyncData(
  `company-edit-${id}`,
  () => gql(COMPANY, { id }),
  { server: false }
)
const company = computed(() => data.value?.companies?.nodes?.[0] ?? null)
const loading = computed(() => status.value === 'pending')

const state = reactive({
  name: '',
  industryName: undefined as string | undefined,
  locations: [] as ListingLocation[],
  orgNumber: '',
  websiteUrl: '',
  careersUrl: '',
  linkedInUrl: '',
  kind: undefined as CompanyKind | undefined,
  sizeBand: undefined as CompanySize | undefined,
  foundedYear: undefined as number | string | undefined,
  description: '',
  workMode: undefined as WorkMode | undefined,
  workingLanguage: undefined as Language | undefined,
  skills: [] as string[]
})
const skillsField = useTemplateRef('skillsField')

const parseOpen = ref(false)
let analyzeOpened = false

// The company loads client-side after setup, so fill the form once it arrives.
watch(
  company,
  (c) => {
    if (!c) return
    state.name = c.name
    state.industryName = c.industry?.name
    state.locations = c.locations.map(({ location: l }) => ({
      countryCode: l.countryCode,
      city: l.city ?? ''
    }))
    state.orgNumber = c.orgNumber ?? ''
    state.websiteUrl = c.websiteUrl ?? ''
    state.careersUrl = c.careersUrl ?? ''
    state.linkedInUrl = c.linkedInUrl ?? ''
    state.kind = c.kind ?? undefined
    state.sizeBand = c.sizeBand ?? undefined
    state.foundedYear = c.foundedYear ?? undefined
    state.description = c.description ?? ''
    state.workMode = c.workMode ?? undefined
    state.workingLanguage = c.workingLanguage ?? undefined
    state.skills = c.skills.map(({ skill }) => skill.name)
    // The company page's "Research company" links here with ?analyze; open the modal only after the
    // fill, or the AI's values would be filled into an empty form and then overwritten by it.
    if (!analyzeOpened && 'analyze' in route.query) {
      analyzeOpened = true
      parseOpen.value = true
    }
  },
  { immediate: true }
)

// What the last AI reply did to the form, so the fill-only-empty rule is visible. Like the listing's
// "Filled from the ad", it stays until dismissed or saved.
const analysis = ref<{ filled: string[]; kept: string[]; ignored: string[] } | null>(null)

// Called by the parse modal; a returned message keeps the modal open with it. The prompt asks for a
// list, so the reply may hold other companies: use the row for this one (or the only row).
const applyReply = (reply: string) => {
  const parsed = parseCompaniesReply(reply)
  if ('error' in parsed) return parsed.error
  const name = company.value!.name.trim().toLowerCase()
  const row =
    parsed.rows.find((r) => typeof r.name === 'string' && r.name.trim().toLowerCase() === name) ??
    (parsed.rows.length === 1 ? parsed.rows[0] : undefined)
  if (!row) return `The reply doesn’t include ${company.value!.name}.`
  const basics = basicsFromJson(row)
  const { research, ignored } = researchFromJson(row)
  skillsField.value?.commit()
  const fromBasics = fillEmptyBasics(state, basics)
  const fromResearch = fillEmptyResearch(state, research)
  analysis.value = {
    filled: [...fromBasics.filled, ...fromResearch.filled],
    kept: [...fromBasics.kept, ...fromResearch.kept],
    ignored: [...basics.ignored, ...ignored]
  }
}

const orgNumber = computed(() => state.orgNumber.replace(/\s/g, ''))
const foundedYear = computed(() =>
  state.foundedYear === undefined || state.foundedYear === '' ? null : Number(state.foundedYear)
)

const thisYear = new Date().getFullYear()

// The API checks these too, but its error doesn't say which field, so they're caught per field here.
const validate = (s: typeof state): FormError[] => {
  const errors: FormError[] = []
  if (orgNumber.value && !isValidOrgNumber(orgNumber.value))
    errors.push({ name: 'orgNumber', message: 'Enter a valid 9-digit org.nr' })
  for (const name of ['websiteUrl', 'careersUrl', 'linkedInUrl'] as const) {
    if (s[name].trim() && !isHttpUrl(s[name].trim()))
      errors.push({ name, message: 'Enter a link starting with http:// or https://' })
  }
  const year = foundedYear.value
  if (year !== null && !(Number.isInteger(year) && year >= FOUNDED_MIN && year <= thisYear))
    errors.push({ name: 'foundedYear', message: `Enter a year from ${FOUNDED_MIN} to ${thisYear}` })
  return errors
}

const toast = useToast()
const saving = ref(false)
const errorMessage = ref('')

// Both mutations replace everything: no industry clears it, a blank research field clears that field.
const onSave = async () => {
  skillsField.value?.commit()
  saving.value = true
  errorMessage.value = ''
  analysis.value = null
  try {
    const { updateCompany, updateCompanyDetails } = await gql(UPDATE_COMPANY, {
      input: {
        id,
        name: state.name.trim(),
        industryName: state.industryName || null,
        locations: state.locations.map((l) => ({ ...l, city: l.city || null }))
      },
      details: {
        id,
        details: {
          orgNumber: orgNumber.value || null,
          websiteUrl: state.websiteUrl.trim() || null,
          careersUrl: state.careersUrl.trim() || null,
          linkedInUrl: state.linkedInUrl.trim() || null,
          kind: state.kind ?? null,
          sizeBand: state.sizeBand ?? null,
          foundedYear: foundedYear.value,
          description: state.description.trim() || null,
          workMode: state.workMode ?? null,
          workingLanguage: state.workingLanguage ?? null,
          skills: state.skills
        }
      }
    })
    const basicErrors = updateCompany.errors ?? []
    const detailErrors = updateCompanyDetails.errors ?? []
    if (basicErrors.length || detailErrors.length) {
      // One part may have saved without the other; say which, so a retry isn't a guess.
      const saved = !basicErrors.length
        ? 'Name, industry and locations were saved. Research not saved: '
        : !detailErrors.length
          ? 'Research was saved. Name, industry and locations not saved: '
          : ''
      errorMessage.value = saved + [...basicErrors, ...detailErrors].map((e) => e.message).join(' ')
      // The company page's key, not this form's: refetching here would overwrite the unsaved edits.
      if (saved) await refreshNuxtData(`company-${id}`)
      return
    }
    clearNuxtState('name-lookups')
    // The company page shares this key and mounts before this page unmounts, so it would reuse
    // the pre-edit data instead of fetching.
    await refreshNuxtData(`company-${id}`)
    toast.add({
      title: 'Company saved',
      color: 'success',
      duration: SUCCESS_TOAST_DURATION,
      icon: 'i-lucide-check'
    })
    // Opened from the company page: step back to that entry, so one Back from there reaches the list.
    if (router.options.history.state.back === `/companies/${id}`) {
      router.back()
    } else {
      await navigateTo(`/companies/${id}`, { replace: true })
    }
  } catch {
    errorMessage.value = ERROR_MESSAGES.generic
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <UAlert
      v-if="error"
      color="error"
      :description="ERROR_MESSAGES.generic"
      class="w-full max-w-3xl"
    />

    <UAlert
      v-else-if="!loading && !company"
      color="error"
      title="Company not found"
      class="w-full max-w-3xl"
    />

    <USkeleton v-else-if="loading" class="h-64 w-full max-w-3xl" />

    <template v-else>
      <!-- Same top row as the listing edit page: Back, then the AI action. -->
      <div
        class="flex w-full max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <UButton
          :to="`/companies/${id}`"
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          class="self-start"
          data-testid="edit-company-back"
          >Back</UButton
        >
        <UButton
          icon="i-lucide-sparkles"
          color="neutral"
          variant="subtle"
          class="self-start"
          data-testid="edit-company-research-ai"
          @click="parseOpen = true"
          >{{
            company && hasCompanyResearch(company) ? 'Re-research company' : 'Research company'
          }}</UButton
        >
      </div>

      <!-- The saved name, not the form's, so the heading doesn't change while typing. -->
      <div class="w-full max-w-3xl">
        <h1 class="break-words text-xl font-semibold text-highlighted">{{ company?.name }}</h1>
      </div>

      <UAlert
        v-if="analysis"
        color="info"
        variant="subtle"
        icon="i-lucide-sparkles"
        :title="
          analysis.filled.length ? 'Filled from the research' : 'Nothing new from the research'
        "
        close
        class="w-full max-w-3xl"
        data-testid="edit-company-analysis"
        @update:open="analysis = null"
      >
        <template #description>
          <p>Only empty fields are filled; your saved values were kept. Nothing is saved yet.</p>
          <p v-if="analysis.filled.length">Filled: {{ analysis.filled.join(', ') }}.</p>
          <p v-if="analysis.kept.length">Kept: {{ analysis.kept.join(', ') }}.</p>
          <p v-if="analysis.ignored.length">Ignored: {{ analysis.ignored.join(', ') }}.</p>
        </template>
      </UAlert>

      <UForm
        :state="state"
        :validate="validate"
        class="w-full max-w-3xl"
        data-testid="edit-company-form"
        @submit="onSave"
      >
        <UCard>
          <div class="space-y-4">
            <h2 class="font-semibold text-highlighted">Basics</h2>
            <div class="grid gap-4 sm:grid-cols-2">
              <!-- A plain input: the companies combobox would suggest renaming into another company. -->
              <UFormField label="Name" name="name" required>
                <UInput v-model="state.name" class="w-full" data-testid="edit-company-name" />
              </UFormField>
              <UFormField label="Industry" name="industryName">
                <ListingsNameCombobox
                  v-model="state.industryName"
                  lookup="industries"
                  placeholder="Search or add"
                  clear
                />
              </UFormField>
            </div>
            <UFormField label="Locations" name="locations">
              <ListingsLocationsField v-model="state.locations" />
            </UFormField>

            <USeparator />

            <h2 class="font-semibold text-highlighted">Company research</h2>

            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField
                label="Description"
                name="description"
                :hint="`${state.description.length}/${DESCRIPTION_MAX}`"
                class="sm:col-span-2"
              >
                <UTextarea
                  v-model="state.description"
                  :rows="4"
                  :maxlength="DESCRIPTION_MAX"
                  autoresize
                  class="w-full"
                  data-testid="edit-company-description"
                />
              </UFormField>
              <UFormField label="Type" name="kind">
                <USelectMenu
                  v-model="state.kind"
                  :items="[...COMPANY_KIND_OPTIONS]"
                  value-key="value"
                  :search-input="false"
                  clear
                  placeholder="Not set"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Size" name="sizeBand" help="Employees">
                <USelectMenu
                  v-model="state.sizeBand"
                  :items="[...COMPANY_SIZE_OPTIONS]"
                  value-key="value"
                  :search-input="false"
                  clear
                  placeholder="Not set"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Work mode" name="workMode">
                <ListingsToggleGroup v-model="state.workMode" :options="WORK_MODE_OPTIONS" />
              </UFormField>
              <UFormField label="Working language" name="workingLanguage">
                <USelectMenu
                  v-model="state.workingLanguage"
                  :items="[...LANGUAGE_OPTIONS]"
                  value-key="value"
                  :search-input="false"
                  clear
                  placeholder="Not set"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Founded" name="foundedYear">
                <UInput
                  v-model="state.foundedYear"
                  type="number"
                  inputmode="numeric"
                  placeholder="e.g. 2008"
                  class="w-full"
                  data-testid="edit-company-founded"
                />
              </UFormField>
              <UFormField label="Org.nr" name="orgNumber" help="9 digits">
                <UInput
                  v-model="state.orgNumber"
                  inputmode="numeric"
                  class="w-full"
                  data-testid="edit-company-org-number"
                />
              </UFormField>
              <UFormField label="Website" name="websiteUrl" class="sm:col-span-2">
                <UInput
                  v-model="state.websiteUrl"
                  type="url"
                  placeholder="https://"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Careers page" name="careersUrl" class="sm:col-span-2">
                <UInput
                  v-model="state.careersUrl"
                  type="url"
                  placeholder="https://"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="LinkedIn" name="linkedInUrl" class="sm:col-span-2">
                <UInput
                  v-model="state.linkedInUrl"
                  type="url"
                  placeholder="https://"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                label="Skills they use"
                help="Technologies and tools from their postings"
                class="sm:col-span-2"
              >
                <ProfileNamesField
                  ref="skillsField"
                  v-model="state.skills"
                  lookup="skills"
                  placeholder="Search or add a skill"
                />
              </UFormField>
            </div>

            <UAlert
              v-if="errorMessage"
              color="error"
              variant="subtle"
              icon="i-lucide-circle-alert"
              :title="errorMessage"
              data-testid="edit-company-error"
            />

            <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <UButton :to="`/companies/${id}`" color="neutral" variant="ghost" :disabled="saving"
                >Cancel</UButton
              >
              <UButton
                type="submit"
                :loading="saving"
                :disabled="!state.name.trim()"
                data-testid="edit-company-save"
                >Save changes</UButton
              >
            </div>
          </div>
        </UCard>
      </UForm>

      <CompaniesParseModal
        v-model:open="parseOpen"
        :apply="applyReply"
        :company-name="company?.name"
      />
    </template>
  </div>
</template>

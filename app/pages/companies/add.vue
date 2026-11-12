<script setup lang="ts">
import type { FormError } from '@nuxt/ui'
import type { ResultOf } from 'gql.tada'
import type { CompanyResearch } from '~/utils/companyResearch'
import type { ListingLocation } from '~/composables/useListingForm'
import { ERROR_MESSAGES } from '~/constants/errorMessages'

definePageMeta({ title: 'Add companies' })

const companiesView = useCompaniesView()

const CREATE_COMPANIES = graphql(`
  mutation CreateCompanies($companies: [CompanyInput!]!) {
    createCompanies(input: { companies: $companies }) {
      results {
        created
        filled
        company {
          id
          name
        }
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

type CompanyResult = NonNullable<
  ResultOf<typeof CREATE_COMPANIES>['createCompanies']['results']
>[number]

interface Row {
  key: number
  name?: string
  industryName?: string
  locations: ListingLocation[]
  // Passed through as pasted (only name, industry and locations are editable here).
  research?: CompanyResearch
  researchSummary: string
  ignored: string[]
  // Picked from the companies list, so the API will fill its empty fields instead of creating it.
  existing: boolean
  saved?: CompanyResult
}

let nextKey = 0
const newRow = (): Row => ({
  key: nextKey++,
  locations: [],
  researchSummary: '',
  ignored: [],
  existing: false
})

// Rows come from the pasted AI reply; "Add row" is only for a stray manual entry.
const state = reactive({ rows: [] as Row[] })

const isBlank = (r: Row) => !r.name?.trim() && !r.industryName && !r.locations.length
const toSave = (rows: Row[]) => rows.filter((r) => !r.saved && !isBlank(r))
const pending = computed(() => toSave(state.rows))
const anySaved = computed(() => state.rows.some((r) => r.saved))

// The API says only "invalid company" with no row, so every problem it could reject has to be
// caught here. Field names use the row key, not the index, so errors stay on the right row.
const validate = (s: typeof state): FormError[] =>
  toSave(s.rows).flatMap((r) =>
    r.name?.trim() ? [] : [{ name: `${r.key}.name`, message: 'Required' }]
  )

const toInput = (r: Row) => ({
  ...r.research,
  name: r.name!.trim(),
  industryName: r.industryName || null,
  locations: r.locations.map((l) => ({ ...l, city: l.city || null }))
})

// The reply is an external AI's JSON, so keep only values a row can hold.
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

const toRow = (d: Record<string, unknown>): Row => {
  const basics = basicsFromJson(d)
  const { research, ignored } = researchFromJson(d)
  return {
    ...newRow(),
    name: text(d?.name) || undefined,
    industryName: basics.industryName,
    locations: basics.locations,
    research,
    researchSummary: researchSummary(research),
    ignored: [...basics.ignored, ...ignored],
    existing: existingNames.has(text(d?.name).toLowerCase())
  }
}

const form = useTemplateRef('form')
const parseOpen = ref(false)
const pastedCount = ref(0)
// "Researched N companies", like the listing's "Filled from the ad": until dismissed.
const researchedNotice = ref(false)

// "Research selected" on the companies list leaves the picked names here; they open the modal.
const researchNames = useState<string[]>('companiesResearchNames', () => [])
const startText = ref('')
const existingNames = new Set(researchNames.value.map((n) => n.toLowerCase()))
onMounted(() => {
  if (!researchNames.value.length) return
  startText.value = researchNames.value.join('\n')
  researchNames.value = []
  parseOpen.value = true
})
// Only the first open starts from the names; "Research more" starts empty.
watch(parseOpen, (isOpen) => {
  if (!isOpen) startText.value = ''
})

// Called by the parse modal; a returned message keeps the modal open with it.
const addRows = (reply: string) => {
  const parsed = parseCompaniesReply(reply)
  if ('error' in parsed) return parsed.error
  const rows = parsed.rows.map(toRow)
  // The handed-over names describe only that first reply, not later ones.
  existingNames.clear()
  researchedNotice.value = true
  // Appended, not replaced, so a second paste never drops rows already saved or edited.
  state.rows.push(...rows)
  pastedCount.value = rows.length
  // Shows what the AI missed (e.g. a null name) right away instead of on Save. The row fields use
  // eager-validation because UForm otherwise only rechecks a field on input after its first blur:
  // the error would stay while fixing it, then vanish on the Save mousedown, shifting Save away
  // from under the click.
  nextTick(() => form.value?.validate({ silent: true }))
}

const count = (n: number, word: string) => (n ? `${n} ${word}` : '')
// "2 created, 1 enriched", leaving out zero counts.
const summarize = (rows: Row[]) => {
  const saved = rows.flatMap((r) => (r.saved ? [r.saved] : []))
  return [
    count(saved.filter((s) => s.created).length, 'created'),
    count(saved.filter((s) => !s.created && s.filled).length, 'enriched'),
    count(saved.filter((s) => !s.created && !s.filled).length, 'unchanged')
  ]
    .filter(Boolean)
    .join(', ')
}
// Every save on this visit, kept on the page after the toast is gone.
const saveSummary = computed(() => summarize(state.rows))

const savedText = (row: Row) => {
  const saved = row.saved!
  if (saved.created) return row.researchSummary ? 'Created with research' : 'Created'
  return saved.filled
    ? 'Already existed, filled in missing details'
    : 'Already existed, nothing new to add'
}

const { success: toastSuccess } = useAppToast()
const saving = ref(false)
const saveError = ref('')

const onSave = async () => {
  const rows = pending.value
  saving.value = true
  saveError.value = ''
  try {
    const { createCompanies } = await gql(CREATE_COMPANIES, { companies: rows.map(toInput) })
    // All or nothing: any error means no row was saved, so the rows stay as they are.
    if (createCompanies.errors?.length) {
      saveError.value = createCompanies.errors.map((e) => e.message).join(' ')
      return
    }
    rows.forEach((row, i) => (row.saved = createCompanies.results?.[i]))
    // Created or filled rows may bring new industries and skills.
    if (rows.some((r) => r.saved?.created || r.saved?.filled)) clearNuxtState('name-lookups')
    toastSuccess(summarize(rows))
  } catch {
    saveError.value = ERROR_MESSAGES.generic
  } finally {
    saving.value = false
  }
}

const removeRow = (row: Row) => state.rows.splice(state.rows.indexOf(row), 1)
</script>

<template>
  <UForm
    ref="form"
    :state="state"
    :validate="validate"
    class="space-y-4"
    data-testid="companies-add-form"
    @submit="onSave"
  >
    <!-- Standalone (home-screen) mode has no browser Back; Cancel sits below every row. -->
    <UButton
      :to="companiesView"
      icon="i-lucide-arrow-left"
      variant="ghost"
      color="neutral"
      data-testid="companies-add-back"
    >
      Back
    </UButton>

    <!-- Opened only on request: a modal over the empty page would hide "Add row". -->
    <CompaniesParseModal v-model:open="parseOpen" :apply="addRows" :initial-text="startText" />

    <div
      v-if="!state.rows.length"
      class="flex flex-col items-center justify-center gap-3 py-12 text-center"
      data-testid="companies-add-empty"
    >
      <UIcon name="i-lucide-building-2" class="size-10 text-muted" />
      <p>No companies yet.</p>
      <p class="text-sm text-muted">
        Enter company names, or paste a page that lists them. The AI adds their details.
      </p>
      <div class="flex flex-col gap-2 sm:flex-row">
        <UButton
          icon="i-lucide-sparkles"
          data-testid="companies-add-paste"
          @click="parseOpen = true"
          >Research companies</UButton
        >
        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="ghost"
          data-testid="companies-add-add-row"
          @click="state.rows.push(newRow())"
          >Add row</UButton
        >
      </div>
    </div>

    <div v-else class="space-y-3" data-testid="companies-add-paste-summary">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm text-muted">
          <template v-if="saveSummary">{{ saveSummary }}.</template>
        </p>
        <UButton
          icon="i-lucide-sparkles"
          color="neutral"
          variant="ghost"
          class="shrink-0"
          data-testid="companies-add-paste-more"
          @click="parseOpen = true"
          >Research more</UButton
        >
      </div>
      <UAlert
        v-if="researchedNotice && pending.length"
        color="info"
        variant="subtle"
        icon="i-lucide-sparkles"
        :title="`Researched ${pastedCount} ${pastedCount === 1 ? 'company' : 'companies'}`"
        close
        data-testid="companies-add-researched"
        @update:open="researchedNotice = $event"
      >
        <template #description>
          <p>Nothing is saved yet. Check them below, then save.</p>
          <p>
            Name, industry and locations are editable here. Description, links, size and skills are
            saved as researched; edit them later on the company.
          </p>
        </template>
      </UAlert>
    </div>

    <UAlert
      v-if="saveError"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="saveError"
      data-testid="companies-add-error"
    />

    <template v-for="row in state.rows" :key="row.key">
      <UCard
        v-if="row.saved"
        :data-testid="
          row.saved.created
            ? 'companies-add-row-saved'
            : row.saved.filled
              ? 'companies-add-row-enriched'
              : 'companies-add-row-existing'
        "
      >
        <div class="flex items-start gap-3">
          <UIcon
            :name="
              row.saved.created
                ? 'i-lucide-circle-check'
                : row.saved.filled
                  ? 'i-lucide-sparkles'
                  : 'i-lucide-info'
            "
            :class="
              row.saved.created ? 'text-success' : row.saved.filled ? 'text-primary' : 'text-muted'
            "
            class="mt-0.5 size-5 shrink-0"
          />
          <div class="min-w-0 flex-1 space-y-1">
            <NuxtLink
              :to="`/companies/${row.saved.company.id}`"
              class="block truncate font-medium text-highlighted hover:underline"
              >{{ row.saved.company.name }}</NuxtLink
            >
            <p class="text-sm text-muted">{{ savedText(row) }}</p>
            <!-- An existing company keeps its own industry and locations, so show them only when created. -->
            <p
              v-if="row.saved.created && (row.industryName || row.locations.length)"
              class="text-sm text-muted"
            >
              {{ [row.industryName, formatPlaces(row.locations)].filter(Boolean).join(' · ') }}
            </p>
          </div>
        </div>
      </UCard>

      <UCard v-else data-testid="companies-add-row">
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="flex items-end gap-2">
            <UFormField
              label="Name"
              eager-validation
              :name="`${row.key}.name`"
              required
              class="min-w-0 flex-1"
            >
              <ListingsNameCombobox
                v-model="row.name"
                lookup="companies"
                placeholder="Search or add"
              />
            </UFormField>
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              aria-label="Remove row"
              data-testid="companies-add-row-remove"
              @click="removeRow(row)"
            />
          </div>
          <UFormField label="Industry" :name="`${row.key}.industryName`">
            <ListingsNameCombobox
              v-model="row.industryName"
              lookup="industries"
              placeholder="Search or add"
            />
          </UFormField>
        </div>
        <UFormField label="Locations" :name="`${row.key}.locations`" class="mt-3">
          <ListingsLocationsField v-model="row.locations" />
        </UFormField>
        <div
          v-if="row.existing || row.researchSummary || row.ignored.length"
          class="mt-3 space-y-1 text-sm"
        >
          <p
            v-if="row.existing"
            class="flex items-start gap-1.5 text-muted"
            data-testid="companies-add-row-existing-note"
          >
            <UIcon name="i-lucide-info" class="mt-0.5 size-4 shrink-0" />
            <span>Existing company, will fill empty fields only</span>
          </p>
          <p
            v-if="row.researchSummary"
            class="flex items-start gap-1.5 text-muted"
            data-testid="companies-add-row-research"
          >
            <UIcon name="i-lucide-sparkles" class="mt-0.5 size-4 shrink-0" />
            <span>Research included: {{ row.researchSummary }}</span>
          </p>
          <p
            v-if="row.ignored.length"
            class="flex items-start gap-1.5 text-warning"
            data-testid="companies-add-row-ignored"
          >
            <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0" />
            <span>Ignored: {{ row.ignored.join(', ') }}</span>
          </p>
        </div>
      </UCard>
    </template>

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
      <UButton
        v-if="state.rows.length"
        icon="i-lucide-plus"
        color="neutral"
        variant="ghost"
        class="justify-center"
        data-testid="companies-add-add-row"
        @click="state.rows.push(newRow())"
        >Add row</UButton
      >
      <div class="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
        <UButton to="/companies" color="neutral" variant="ghost" class="justify-center">{{
          anySaved ? 'Done' : 'Cancel'
        }}</UButton>
        <UButton
          type="submit"
          :loading="saving"
          :disabled="!pending.length"
          class="justify-center"
          data-testid="companies-add-save"
          >Save {{ pending.length || '' }}
          {{ pending.length === 1 ? 'company' : 'companies' }}</UButton
        >
      </div>
    </div>
  </UForm>
</template>

<script setup lang="ts">
import type { FormError } from '@nuxt/ui'
import type { ResultOf } from 'gql.tada'
import type { ListingLocation } from '~/composables/useListingForm'
import { COUNTRY_CODES } from '~/constants/countries'
import { ERROR_MESSAGES } from '~/constants/errorMessages'

definePageMeta({ title: 'Add companies' })

const CREATE_COMPANIES = graphql(`
  mutation CreateCompanies($companies: [CompanyInput!]!) {
    createCompanies(input: { companies: $companies }) {
      results {
        created
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
  saved?: CompanyResult
}

let nextKey = 0
const newRow = (): Row => ({ key: nextKey++, locations: [] })

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
  name: r.name!.trim(),
  industryName: r.industryName || null,
  locations: r.locations.map((l) => ({ ...l, city: l.city || null }))
})

// The reply is an external AI's JSON, so keep only values a row can hold.
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const list = (v: unknown) => (Array.isArray(v) ? v : [])

const toRow = (d: Record<string, unknown>): Row => ({
  ...newRow(),
  name: text(d?.name) || undefined,
  industryName: text(d?.industryName) || undefined,
  locations: list(d?.locations)
    .filter((l) => COUNTRY_CODES.find((c) => c === l?.countryCode))
    .map((l) => ({ countryCode: l.countryCode, city: text(l.city) }))
})

const { instructions, copied, load, copy, parsing, parse } = useParsePrompt('companyParsePrompt')
onMounted(load)

const form = useTemplateRef('form')
const pasteOpen = ref(true)
const ad = ref('')
const json = ref('')
const jsonError = ref('')
const pastedCount = ref(0)
const builtIn = ref(false)
watch(json, () => (jsonError.value = ''))

const addRows = async (reply: string) => {
  // AIs often wrap the JSON in a code fence or a sentence, so take the outermost array.
  const raw = reply.slice(reply.indexOf('['), reply.lastIndexOf(']') + 1)
  let items: unknown
  try {
    items = JSON.parse(raw)
  } catch {
    jsonError.value = 'That doesn’t look like a valid JSON array.'
    return false
  }
  const rows = list(items).map(toRow)
  if (!rows.length) {
    jsonError.value = 'No companies found in that reply.'
    return false
  }
  // Appended, not replaced, so a second paste never drops rows already saved or edited.
  state.rows.push(...rows)
  pastedCount.value = rows.length
  ad.value = ''
  json.value = ''
  pasteOpen.value = false
  // Shows what the AI missed (e.g. a null name) right away instead of on Save. The row fields use
  // eager-validation because UForm otherwise only rechecks a field on input after its first blur:
  // the error would stay while fixing it, then vanish on the Save mousedown, shifting Save away
  // from under the click.
  await nextTick()
  form.value?.validate({ silent: true })
  return true
}

const parseBuiltIn = async () => {
  const reply = await parse(ad.value)
  if ('error' in reply) {
    toast.add({ title: reply.error, color: 'error', icon: 'i-lucide-circle-alert' })
  }
  // Failed: show the copy-paste steps, with the text still filled in.
  if ('error' in reply || !(await addRows(reply.result))) builtIn.value = false
}

const toast = useToast()
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
    const createdCount = rows.filter((r) => r.saved?.created).length
    if (createdCount) {
      clearNuxtState('name-lookups')
      toast.add({
        title: `${createdCount} ${createdCount === 1 ? 'company' : 'companies'} added`,
        color: 'success',
        icon: 'i-lucide-check'
      })
    }
  } catch {
    saveError.value = ERROR_MESSAGES.generic
  } finally {
    saving.value = false
  }
}

const removeRow = (row: Row) => state.rows.splice(state.rows.indexOf(row), 1)

const places = (r: Row) =>
  r.locations.map((l) => (l.city ? `${l.city}, ${l.countryCode}` : l.countryCode)).join(' · ')
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
    <UCard v-if="pasteOpen" data-testid="companies-add-paste">
      <div class="space-y-6">
        <div class="space-y-3">
          <UCheckbox
            v-model="builtIn"
            label="Use built-in parser"
            data-testid="companies-add-builtin"
          />
          <UFormField
            :label="
              builtIn
                ? 'Paste company names, or a page that lists companies'
                : '1. Paste company names, or a page that lists companies'
            "
            help="Only name, industry and locations are parsed."
          >
            <UTextarea
              v-model="ad"
              :rows="6"
              :maxrows="12"
              autoresize
              placeholder="The names or the page text"
              class="w-full"
              data-testid="companies-add-ad"
            />
          </UFormField>
          <UButton
            v-if="builtIn"
            icon="i-lucide-sparkles"
            :loading="parsing"
            :disabled="!ad.trim()"
            data-testid="companies-add-builtin-run"
            @click="parseBuiltIn"
          >
            Parse into rows
          </UButton>
          <UButton
            v-else
            :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            :color="copied ? 'success' : 'primary'"
            variant="subtle"
            :loading="!instructions"
            :disabled="!ad.trim()"
            data-testid="companies-add-copy-prompt"
            @click="copy(ad)"
          >
            {{ copied ? 'Copied' : 'Copy prompt' }}
          </UButton>
        </div>

        <USeparator v-if="!builtIn" />

        <div v-if="!builtIn" class="space-y-3">
          <UFormField label="2. Paste the AI’s reply" :error="jsonError || undefined">
            <UTextarea
              v-model="json"
              :rows="6"
              :maxrows="12"
              autoresize
              placeholder="The JSON array the AI returned"
              class="w-full font-mono"
              data-testid="companies-add-json"
            />
          </UFormField>
          <UButton :disabled="!json.trim()" data-testid="companies-add-parse" @click="addRows(json)"
            >Parse into rows</UButton
          >
        </div>
      </div>
    </UCard>

    <div
      v-else
      class="flex items-center justify-between gap-2"
      data-testid="companies-add-paste-summary"
    >
      <p class="text-sm text-muted">
        Pasted {{ pastedCount }} {{ pastedCount === 1 ? 'company' : 'companies' }}. Check them
        below, then save.
      </p>
      <UButton
        icon="i-lucide-clipboard-paste"
        color="neutral"
        variant="ghost"
        data-testid="companies-add-paste-more"
        @click="pasteOpen = true"
        >Paste more</UButton
      >
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
        :data-testid="row.saved.created ? 'companies-add-row-saved' : 'companies-add-row-existing'"
      >
        <div class="flex items-start gap-3">
          <UIcon
            :name="row.saved.created ? 'i-lucide-circle-check' : 'i-lucide-info'"
            :class="row.saved.created ? 'text-success' : 'text-muted'"
            class="mt-0.5 size-5 shrink-0"
          />
          <div class="min-w-0 flex-1 space-y-1">
            <p class="truncate font-medium text-highlighted">{{ row.saved.company.name }}</p>
            <!-- An existing company keeps its own industry and locations, so show none for it. -->
            <p v-if="!row.saved.created" class="text-sm text-muted">
              Already existed, left unchanged
            </p>
            <p v-else-if="row.industryName || row.locations.length" class="text-sm text-muted">
              {{ [row.industryName, places(row)].filter(Boolean).join(' · ') }}
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
      </UCard>
    </template>

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
      <UButton
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

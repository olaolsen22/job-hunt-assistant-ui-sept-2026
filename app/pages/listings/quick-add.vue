<script setup lang="ts">
import type { FormError } from '@nuxt/ui'
import { print } from '@0no-co/graphql.web'
import type { ResultOf } from 'gql.tada'
import type { ListingLocation } from '~/composables/useListingForm'
import { COUNTRY_CODES } from '~/constants/countries'
import { ERROR_MESSAGES } from '~/constants/errorMessages'
import { DEADLINE_TYPE_OPTIONS } from '~/constants/listing'
import type { DeadlineType } from '~/constants/listing'

definePageMeta({ title: 'Quick add listings' })

const RESULT_FRAGMENT = graphql(`
  fragment R on CreateListingPayload {
    listing {
      id
      title
      url
    }
    possibleDuplicates {
      id
      title
      archivedAt
      company {
        name
      }
      jobRole {
        name
      }
    }
    errors {
      __typename
      ... on Error {
        message
      }
      ... on DuplicateListingError {
        existingListingId
      }
    }
  }
`)

type CreateListingResult = ResultOf<typeof RESULT_FRAGMENT>
type PossibleDuplicate = NonNullable<CreateListingResult['possibleDuplicates']>[number]

interface Row {
  key: number
  title: string
  companyName?: string
  jobRoleName?: string
  url: string
  postedOn: string
  deadlineType: DeadlineType
  deadlineOn: string
  locations: ListingLocation[]
  saved?: CreateListingResult['listing']
  duplicates?: PossibleDuplicate[]
  error?: string
  existingListingId?: number
}

// One aliased createListing per row keeps a batch to one request; the API saves each row on its
// own, so one failing row doesn't stop the others.
const buildMutation = (count: number) => {
  const indexes = [...Array(count).keys()]
  return batchDocument<CreateListingResult>(`
    mutation QuickAddListings(${indexes.map((i) => `$l${i}: ListingInput!`).join(', ')}) {
      ${indexes.map((i) => `r${i}: createListing(input: { listing: $l${i} }) { ...R }`).join('\n')}
    }
    ${print(RESULT_FRAGMENT)}
  `)
}

const DELETE_LISTING = graphql(`
  mutation DeleteListing($id: Int!) {
    deleteListing(input: { id: $id }) {
      errors {
        __typename
        ... on Error {
          message
        }
      }
    }
  }
`)

let nextKey = 0
const newRow = (): Row => ({
  key: nextKey++,
  title: '',
  url: '',
  postedOn: todayIso(),
  deadlineType: 'UNSPECIFIED',
  deadlineOn: '',
  locations: []
})

// Rows come from the pasted AI reply; "Add row" is only for a stray manual entry.
const state = reactive({ rows: [] as Row[] })

const isBlank = (r: Row) => !r.title.trim() && !r.companyName && !r.jobRoleName && !r.url.trim()
const toSave = (rows: Row[]) => rows.filter((r) => !r.saved && !isBlank(r))
const pending = computed(() => toSave(state.rows))
const anySaved = computed(() => state.rows.some((r) => r.saved))

// Field names use the row key, not the index, so errors stay on the right row after a removal.
const validate = (s: typeof state): FormError[] =>
  toSave(s.rows).flatMap((r) => {
    const errors: FormError[] = []
    if (!r.title.trim()) errors.push({ name: `${r.key}.title`, message: 'Required' })
    if (!r.companyName) errors.push({ name: `${r.key}.companyName`, message: 'Required' })
    if (!r.jobRoleName) errors.push({ name: `${r.key}.jobRoleName`, message: 'Required' })
    if (!/^https?:\/\/\S+$/i.test(r.url.trim())) {
      errors.push({ name: `${r.key}.url`, message: 'Enter an http(s) link' })
    }
    if (!r.postedOn) {
      errors.push({ name: `${r.key}.postedOn`, message: 'Required' })
    } else if (r.postedOn > todayIso()) {
      errors.push({ name: `${r.key}.postedOn`, message: 'Can’t be in the future' })
    }
    if (r.deadlineType === 'DATE' && !r.deadlineOn) {
      errors.push({ name: `${r.key}.deadlineOn`, message: 'Pick a date' })
    }
    return errors
  })

// Skills and languages are filled in later on the edit page.
const toInput = (r: Row) => ({
  title: r.title.trim(),
  companyName: r.companyName,
  jobRoleName: r.jobRoleName,
  url: r.url.trim(),
  postedOn: r.postedOn,
  deadlineType: r.deadlineType,
  // The API rejects a date unless the type is DATE.
  deadlineOn: r.deadlineType === 'DATE' ? r.deadlineOn : null,
  locations: r.locations.map((l) => ({ ...l, city: l.city || null })),
  skills: [],
  languages: []
})

// The reply is an external AI's JSON, so keep only values a row can hold.
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const isoDate = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '')
const list = (v: unknown) => (Array.isArray(v) ? v : [])

const toRow = (d: Record<string, unknown>): Row => ({
  ...newRow(),
  title: text(d?.title),
  companyName: text(d?.companyName) || undefined,
  jobRoleName: text(d?.jobRoleName) || undefined,
  url: text(d?.url),
  postedOn: isoDate(d?.postedOn) || todayIso(),
  deadlineType:
    DEADLINE_TYPE_OPTIONS.find((o) => o.value === d?.deadlineType)?.value ?? 'UNSPECIFIED',
  deadlineOn: isoDate(d?.deadlineOn),
  locations: list(d?.locations)
    .filter((l) => COUNTRY_CODES.find((c) => c === l?.countryCode))
    .map((l) => ({ countryCode: l.countryCode, city: text(l.city) }))
})

const { instructions, copied, load, copy, parsing, parse } =
  useParsePrompt('listingQuickParsePrompt')
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
    jsonError.value = 'No listings found in that reply.'
    return false
  }
  // Appended, not replaced, so a second paste never drops rows already saved or edited.
  state.rows.push(...rows)
  pastedCount.value = rows.length
  ad.value = ''
  json.value = ''
  pasteOpen.value = false
  // Shows what the AI missed (e.g. a null url) right away instead of on Save. The row fields use
  // eager-validation because UForm otherwise only rechecks a field on input after its first blur:
  // the error would stay while fixing it, then vanish on the Save mousedown, shifting Save away
  // from under the click.
  await nextTick()
  form.value?.validate({ silent: true })
  return true
}

const parseBuiltIn = async () => {
  const reply = await parse(ad.value)
  // Failed: show the copy-paste steps, with the ads still filled in.
  if (!reply || !(await addRows(reply))) builtIn.value = false
}

const toast = useToast()
const saving = ref(false)
const saveError = ref('')

const onSave = async () => {
  const rows = pending.value
  saving.value = true
  saveError.value = ''
  try {
    const data = await gql(
      buildMutation(rows.length),
      Object.fromEntries(rows.map((r, i) => [`l${i}`, toInput(r)]))
    )
    rows.forEach((row, i) => {
      const { listing, possibleDuplicates, errors } = data[`r${i}`]!
      Object.assign(row, {
        saved: listing ?? undefined,
        duplicates: possibleDuplicates?.length ? possibleDuplicates : undefined,
        error: errors?.map((e) => e.message).join(' '),
        existingListingId: errors?.find((e) => e.__typename === 'DuplicateListingError')
          ?.existingListingId
      })
    })
    const savedCount = rows.filter((r) => r.saved).length
    if (savedCount) {
      clearNuxtState('name-lookups')
      toast.add({
        title: `${savedCount} ${savedCount === 1 ? 'listing' : 'listings'} added`,
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

const toRemove = ref<Row>()
const confirmOpen = ref(false)
const deleting = ref(false)

const askRemove = (row: Row) => {
  toRemove.value = row
  confirmOpen.value = true
}

const onConfirmRemove = async () => {
  const row = toRemove.value!
  deleting.value = true
  try {
    const { deleteListing } = await gql(DELETE_LISTING, {
      id: row.saved!.id
    })
    if (deleteListing.errors?.length) {
      toast.add({ title: deleteListing.errors.map((e) => e.message).join(' '), color: 'error' })
      return
    }
    removeRow(row)
    toast.add({ title: 'Listing removed', color: 'success', icon: 'i-lucide-check' })
  } catch {
    toast.add({ title: ERROR_MESSAGES.generic, color: 'error' })
  } finally {
    deleting.value = false
    confirmOpen.value = false
  }
}
</script>

<template>
  <UForm
    ref="form"
    :state="state"
    :validate="validate"
    class="space-y-4"
    data-testid="quick-add-form"
    @submit="onSave"
  >
    <UCard v-if="pasteOpen" data-testid="quick-add-paste">
      <div class="space-y-6">
        <div class="space-y-3">
          <UCheckbox
            v-model="builtIn"
            label="Use built-in parser"
            data-testid="quick-add-builtin"
          />
          <UFormField
            :label="
              builtIn
                ? 'Paste one or more ads, or a job-board results page'
                : '1. Paste one or more ads, or a job-board results page'
            "
            help="Only the basics are parsed; fill in the details later."
          >
            <UTextarea
              v-model="ad"
              :rows="6"
              :maxrows="12"
              autoresize
              placeholder="The ads or results page text"
              class="w-full"
              data-testid="quick-add-ad"
            />
          </UFormField>
          <UButton
            v-if="builtIn"
            icon="i-lucide-sparkles"
            :loading="parsing"
            :disabled="!ad.trim()"
            data-testid="quick-add-builtin-run"
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
            data-testid="quick-add-copy-prompt"
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
              data-testid="quick-add-json"
            />
          </UFormField>
          <UButton :disabled="!json.trim()" data-testid="quick-add-parse" @click="addRows(json)"
            >Parse into rows</UButton
          >
        </div>
      </div>
    </UCard>

    <div
      v-else
      class="flex items-center justify-between gap-2"
      data-testid="quick-add-paste-summary"
    >
      <p class="text-sm text-muted">
        Pasted {{ pastedCount }} {{ pastedCount === 1 ? 'listing' : 'listings' }}. Check them below,
        then save.
      </p>
      <UButton
        icon="i-lucide-clipboard-paste"
        color="neutral"
        variant="ghost"
        data-testid="quick-add-paste-more"
        @click="pasteOpen = true"
        >Paste more</UButton
      >
    </div>

    <template v-for="row in state.rows" :key="row.key">
      <UCard v-if="row.saved" data-testid="quick-add-row-saved">
        <div class="flex items-start gap-3">
          <UIcon name="i-lucide-circle-check" class="mt-0.5 size-5 shrink-0 text-success" />
          <div class="min-w-0 flex-1 space-y-1">
            <NuxtLink
              :to="`/listings/${row.saved.id}`"
              class="font-medium text-highlighted hover:underline"
              >{{ row.saved.title }}</NuxtLink
            >
            <p class="text-sm text-muted">{{ row.companyName }} · {{ row.jobRoleName }}</p>
            <!-- The API's cleaned-up URL, which can differ from what was typed. -->
            <ULink :to="row.saved.url" target="_blank" class="block truncate text-sm">{{
              row.saved.url
            }}</ULink>
          </div>
        </div>

        <UAlert
          v-if="row.duplicates"
          color="warning"
          variant="subtle"
          icon="i-lucide-copy"
          title="Possible duplicate"
          class="mt-3"
          data-testid="quick-add-row-duplicates"
        >
          <template #description>
            <ul class="space-y-1">
              <li
                v-for="match in row.duplicates"
                :key="match.id"
                class="flex flex-wrap items-center gap-x-2"
              >
                <NuxtLink :to="`/listings/${match.id}`" class="font-medium hover:underline">{{
                  match.title
                }}</NuxtLink>
                <span class="text-muted">{{ match.company.name }} · {{ match.jobRole.name }}</span>
                <!-- Archived means the user already applied to it. -->
                <UBadge v-if="match.archivedAt" color="neutral" variant="subtle" size="sm"
                  >Applied</UBadge
                >
              </li>
            </ul>
            <div class="mt-3 flex flex-wrap gap-2">
              <UButton
                size="sm"
                color="neutral"
                variant="outline"
                @click="row.duplicates = undefined"
                >Keep both</UButton
              >
              <UButton
                size="sm"
                color="error"
                variant="soft"
                data-testid="quick-add-row-remove-duplicate"
                @click="askRemove(row)"
                >Remove this one</UButton
              >
            </div>
          </template>
        </UAlert>
      </UCard>

      <UCard v-else data-testid="quick-add-row">
        <div class="grid gap-3 sm:grid-cols-2 xl:flex xl:items-start">
          <UFormField
            label="Job title"
            eager-validation
            :name="`${row.key}.title`"
            required
            class="sm:col-span-2 xl:flex-1"
          >
            <UInput v-model="row.title" class="w-full" />
          </UFormField>
          <UFormField
            label="Company"
            eager-validation
            :name="`${row.key}.companyName`"
            required
            class="xl:w-44"
          >
            <ListingsNameCombobox
              v-model="row.companyName"
              lookup="companies"
              placeholder="Search or add"
            />
          </UFormField>
          <UFormField
            label="Role"
            eager-validation
            :name="`${row.key}.jobRoleName`"
            required
            class="xl:w-44"
          >
            <ListingsNameCombobox
              v-model="row.jobRoleName"
              lookup="jobRoles"
              placeholder="Search or add"
            />
          </UFormField>
          <UFormField
            label="Job ad URL"
            eager-validation
            :name="`${row.key}.url`"
            required
            class="sm:col-span-2 xl:flex-1"
          >
            <UInput v-model="row.url" type="url" placeholder="https://" class="w-full" />
          </UFormField>
          <div class="flex items-end gap-2 xl:w-48">
            <UFormField
              label="Posted on"
              eager-validation
              :name="`${row.key}.postedOn`"
              required
              class="flex-1"
            >
              <UInput v-model="row.postedOn" type="date" :max="todayIso()" class="w-full" />
            </UFormField>
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              aria-label="Remove row"
              data-testid="quick-add-row-remove"
              @click="removeRow(row)"
            />
          </div>
        </div>

        <div class="mt-3 flex flex-wrap items-end gap-3">
          <UFormField label="Deadline" :name="`${row.key}.deadlineType`" class="w-40">
            <USelect
              v-model="row.deadlineType"
              :items="[...DEADLINE_TYPE_OPTIONS]"
              class="w-full"
              data-testid="quick-add-row-deadline-type"
            />
          </UFormField>
          <UFormField
            v-if="row.deadlineType === 'DATE'"
            label="Deadline date"
            eager-validation
            :name="`${row.key}.deadlineOn`"
            class="w-40"
          >
            <UInput
              v-model="row.deadlineOn"
              type="date"
              class="w-full"
              data-testid="quick-add-row-deadline-on"
            />
          </UFormField>
          <!-- Read-only: the locations repeater is too big for a row; fix them on the edit page. -->
          <p
            v-if="row.locations.length"
            class="flex items-center gap-1 pb-1.5 text-sm text-muted"
            data-testid="quick-add-row-locations"
          >
            <UIcon name="i-lucide-map-pin" class="size-4 shrink-0" />
            {{
              row.locations
                .map((l) => (l.city ? `${l.city}, ${l.countryCode}` : l.countryCode))
                .join(' · ')
            }}
          </p>
        </div>

        <UAlert
          v-if="row.error"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="row.error"
          class="mt-3"
          data-testid="quick-add-row-error"
        >
          <template v-if="row.existingListingId" #description>
            <NuxtLink :to="`/listings/${row.existingListingId}`" class="underline"
              >View the existing listing</NuxtLink
            >
          </template>
        </UAlert>
      </UCard>
    </template>

    <UAlert
      v-if="saveError"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      :title="saveError"
    />

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
      <UButton
        icon="i-lucide-plus"
        color="neutral"
        variant="ghost"
        class="justify-center"
        data-testid="quick-add-add-row"
        @click="state.rows.push(newRow())"
        >Add row</UButton
      >
      <div class="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
        <UButton to="/listings" color="neutral" variant="ghost" class="justify-center">{{
          anySaved ? 'Done' : 'Cancel'
        }}</UButton>
        <UButton
          type="submit"
          :loading="saving"
          :disabled="!pending.length"
          class="justify-center"
          data-testid="quick-add-save"
          >Save {{ pending.length || '' }}
          {{ pending.length === 1 ? 'listing' : 'listings' }}</UButton
        >
      </div>
    </div>

    <AppConfirmModal
      v-model:open="confirmOpen"
      title="Remove this listing?"
      :description="toRemove?.saved?.title"
      confirm-label="Remove"
      :loading="deleting"
      @confirm="onConfirmRemove"
    />
  </UForm>
</template>

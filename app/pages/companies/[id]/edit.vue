<script setup lang="ts">
import { SUCCESS_TOAST_DURATION } from '~/constants/ui'
import type { ListingLocation } from '~/composables/useListingForm'
import { ERROR_MESSAGES } from '~/constants/errorMessages'

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
      }
    }
  }
`)

const UPDATE_COMPANY = graphql(`
  mutation UpdateCompany($input: UpdateCompanyInput!) {
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
  locations: [] as ListingLocation[]
})

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
  },
  { immediate: true }
)

const toast = useToast()
const saving = ref(false)
const errorMessage = ref('')

// updateCompany replaces everything, so the whole form is sent; no industry clears it.
const onSave = async () => {
  saving.value = true
  errorMessage.value = ''
  try {
    const { updateCompany } = await gql(UPDATE_COMPANY, {
      input: {
        id,
        name: state.name.trim(),
        industryName: state.industryName || null,
        locations: state.locations.map((l) => ({ ...l, city: l.city || null }))
      }
    })
    if (updateCompany.errors?.length) {
      errorMessage.value = updateCompany.errors.map((e) => e.message).join(' ')
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
      <div class="w-full max-w-3xl space-y-4">
        <UButton
          :to="`/companies/${id}`"
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          data-testid="edit-company-back"
          >Back</UButton
        >
        <!-- The saved name, not the form's, so the heading doesn't change while typing. -->
        <h1 class="break-words text-xl font-semibold text-highlighted">{{ company?.name }}</h1>
      </div>

      <UForm
        :state="state"
        class="w-full max-w-3xl"
        data-testid="edit-company-form"
        @submit="onSave"
      >
        <UCard>
          <div class="space-y-4">
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
    </template>
  </div>
</template>

<script setup lang="ts">
import type { QuickAddRow } from '~/composables/useQuickAddRows'
import { DEADLINE_TYPE_OPTIONS } from '~/constants/listing'

// One unsaved listing's basics. Field names resolve to the page's form, whose validate covers every
// row; they use the row key so errors stay on the right row after a removal.
defineProps<{ processing: boolean }>()
// A model, not a plain prop: the fields edit this row object, which lives in the page's list.
const row = defineModel<QuickAddRow>('row', { required: true })
defineEmits<{ remove: [] }>()
</script>

<template>
  <UCard data-testid="quick-add-row">
    <div class="grid gap-3 sm:grid-cols-2 xl:flex xl:items-start">
      <UFormField
        label="Job title"
        eager-validation
        :name="`${row.key}.title`"
        required
        class="sm:col-span-2 xl:flex-1"
      >
        <UInput v-model="row.title" :disabled="processing" class="w-full" />
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
          :disabled="processing"
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
          :disabled="processing"
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
        <div class="flex items-center gap-2">
          <UInput
            v-model="row.url"
            :disabled="processing"
            type="url"
            placeholder="https://"
            class="min-w-0 flex-1"
          />
          <UButton
            v-if="/^https?:\/\/\S+$/i.test(row.url.trim())"
            :to="row.url.trim()"
            target="_blank"
            rel="noopener noreferrer"
            icon="i-lucide-external-link"
            color="neutral"
            variant="ghost"
            aria-label="Open job ad in a new tab"
            title="Open job ad in a new tab"
            data-testid="quick-add-row-open-ad"
          />
        </div>
      </UFormField>
      <div class="flex items-end gap-2 xl:w-48">
        <UFormField
          label="Posted on"
          eager-validation
          :name="`${row.key}.postedOn`"
          required
          class="flex-1"
        >
          <UInput
            v-model="row.postedOn"
            :disabled="processing"
            type="date"
            :max="todayIso()"
            class="w-full"
          />
        </UFormField>
        <UButton
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          aria-label="Remove row"
          data-testid="quick-add-row-remove"
          :disabled="processing"
          @click="$emit('remove')"
        />
      </div>
    </div>

    <div class="mt-3 flex flex-wrap items-end gap-3">
      <UFormField label="Deadline" :name="`${row.key}.deadlineType`" class="w-40">
        <USelect
          v-model="row.deadlineType"
          :disabled="processing"
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
          :disabled="processing"
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

<script setup lang="ts">
import type { CompanyContact } from '~/composables/contactFields'

// Read-only unless `editable`; the company page manages contacts, the listing page only shows them.
defineProps<{ contacts: readonly CompanyContact[]; editable?: boolean }>()
const emit = defineEmits<{ edit: [CompanyContact]; delete: [CompanyContact] }>()
</script>

<template>
  <ul class="divide-y divide-default" data-testid="contacts">
    <li
      v-for="c in contacts"
      :key="c.id"
      class="flex items-start gap-2 py-3 first:pt-0 last:pb-0"
      data-testid="contact"
    >
      <div class="min-w-0 flex-1">
        <p class="break-words font-medium text-highlighted">{{ c.name }}</p>
        <p v-if="c.title" class="break-words text-sm text-muted">{{ c.title }}</p>
        <div v-if="c.email || c.phone || c.url" class="flex flex-wrap gap-x-3">
          <UButton
            v-if="c.email"
            :to="`mailto:${c.email}`"
            icon="i-lucide-mail"
            color="neutral"
            variant="link"
            size="sm"
            class="min-w-0 break-all px-0"
            >{{ c.email }}</UButton
          >
          <UButton
            v-if="c.phone"
            :to="`tel:${c.phone}`"
            icon="i-lucide-phone"
            color="neutral"
            variant="link"
            size="sm"
            class="px-0"
            >{{ c.phone }}</UButton
          >
          <UButton
            v-if="c.url"
            :to="c.url"
            target="_blank"
            icon="i-lucide-external-link"
            color="neutral"
            variant="link"
            size="sm"
            class="px-0"
            >Profile</UButton
          >
        </div>
        <LazyAppMarkdownContent v-if="c.notes" :source="c.notes" class="mt-1 text-sm" />
      </div>
      <template v-if="editable">
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="`Edit ${c.name}`"
          data-testid="contact-edit"
          @click="emit('edit', c)"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="`Delete ${c.name}`"
          data-testid="contact-delete"
          @click="emit('delete', c)"
        />
      </template>
    </li>
  </ul>
</template>

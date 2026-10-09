<script setup lang="ts">
import type { ListingContact } from '~/composables/useListingForm'

const contacts = defineModel<ListingContact[]>({ required: true })

const addContact = () =>
  contacts.value.push({ name: '', title: null, email: null, phone: null, url: null })
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="(c, i) in contacts"
      :key="i"
      class="flex items-start gap-2 border-b border-default pb-4"
      data-testid="contact-row"
    >
      <div class="grid flex-1 gap-2 sm:grid-cols-2">
        <UInput v-model="c.name" placeholder="Name" aria-label="Contact name" class="w-full" />
        <UInput
          :model-value="c.title ?? ''"
          placeholder="Title"
          aria-label="Contact title"
          class="w-full"
          @update:model-value="c.title = String($event)"
        />
        <UInput
          :model-value="c.email ?? ''"
          type="email"
          placeholder="Email"
          aria-label="Contact email"
          class="w-full"
          @update:model-value="c.email = String($event)"
        />
        <UInput
          :model-value="c.phone ?? ''"
          type="tel"
          placeholder="Phone"
          aria-label="Contact phone"
          class="w-full"
          @update:model-value="c.phone = String($event)"
        />
        <UInput
          :model-value="c.url ?? ''"
          type="url"
          placeholder="Link"
          aria-label="Contact link"
          class="w-full sm:col-span-2"
          @update:model-value="c.url = String($event)"
        />
      </div>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        aria-label="Remove contact"
        class="shrink-0"
        @click="contacts.splice(i, 1)"
      />
    </div>
    <UButton
      icon="i-lucide-user-plus"
      color="neutral"
      variant="subtle"
      class="w-full justify-center sm:w-auto"
      @click="addContact"
    >
      Add contact
    </UButton>
  </div>
</template>

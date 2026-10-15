<script setup lang="ts">
import { PROFILE_FIELDS, type ProfileData } from '~/composables/useProfile'

const { profile } = defineProps<{ profile: ProfileData }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [profile: ProfileData]; changed: [] }>()

const UPDATE_ADDRESS = graphql(
  `
    mutation UpdateProfileAddress($input: UpdateProfileAddressInput!) {
      updateProfileAddress(input: $input) {
        profile {
          ...ProfileFields
        }
        errors {
          __typename
          ... on Error {
            message
          }
        }
      }
    }
  `,
  [PROFILE_FIELDS]
)

const address = ref({ streetAddress: '', postalCode: '' })

watch(open, (isOpen) => {
  if (!isOpen) return
  address.value = {
    streetAddress: profile.streetAddress ?? '',
    postalCode: profile.postalCode ?? ''
  }
})

const { run, loading } = useMutation(() => emit('changed'))

// The API replaces both fields, so both go out; a blank one is cleared.
const submit = async () => {
  let saved: ProfileData | null = null
  const ok = await run(async () => {
    const { updateProfileAddress } = await gql(UPDATE_ADDRESS, {
      input: {
        streetAddress: address.value.streetAddress.trim() || null,
        postalCode: address.value.postalCode.trim() || null
      }
    })
    saved = updateProfileAddress.profile
    return updateProfileAddress.errors
  })
  if (!ok || !saved) return
  open.value = false
  emit('saved', saved)
}
</script>

<template>
  <AppFormModal
    v-model:open="open"
    title="Edit address"
    description="Printed on cover letters only. Never sent to AI."
    save-label="Save address"
    :state="address"
    :loading="loading"
    @submit="submit"
  >
    <div class="space-y-4">
      <UFormField label="Street address" name="streetAddress">
        <UInput
          v-model="address.streetAddress"
          :maxlength="100"
          autocomplete="address-line1"
          placeholder="Storgata 1"
          class="w-full"
          data-testid="address-street"
        />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-3">
        <UFormField label="Postcode" name="postalCode">
          <UInput
            v-model="address.postalCode"
            :maxlength="20"
            autocomplete="postal-code"
            placeholder="6413"
            class="w-full"
            data-testid="address-postcode"
          />
        </UFormField>
        <!-- The town isn't stored with the address; the API prints the profile location's city. -->
        <div class="text-sm sm:col-span-2" data-testid="address-town">
          <p class="font-medium text-default">Town</p>
          <p v-if="profile.location?.city" class="mt-1">{{ profile.location.city }}</p>
          <p v-else class="mt-1 text-muted">Town not set</p>
          <p class="text-xs text-muted">From your location under Basics</p>
        </div>
      </div>
      <p class="text-xs text-muted">Leave both empty to remove your address.</p>
    </div>
  </AppFormModal>
</template>

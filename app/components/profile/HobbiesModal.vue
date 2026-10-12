<script setup lang="ts">
import type { ProfileData } from '~/composables/useProfile'

const { profile } = defineProps<{ profile: ProfileData }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [profile: ProfileData]; changed: [] }>()

const hobbies = ref<string[]>([])
const namesField = useTemplateRef('namesField')

watch(open, (isOpen) => {
  if (isOpen) hobbies.value = [...profile.hobbies]
})

const { save, loading } = useProfileUpdate(() => emit('changed'))

const submit = async () => {
  namesField.value?.commit()
  const saved = await save(profile, { hobbies: hobbies.value })
  if (!saved) return
  open.value = false
  emit('saved', saved)
}
</script>

<template>
  <AppFormModal
    v-model:open="open"
    :title="profile.hobbies.length ? 'Edit hobbies' : 'Add hobbies'"
    :state="{ hobbies }"
    :loading="loading"
    @submit="submit"
  >
    <UFormField label="Hobbies">
      <ProfileNamesField ref="namesField" v-model="hobbies" placeholder="Add a hobby" />
    </UFormField>
  </AppFormModal>
</template>

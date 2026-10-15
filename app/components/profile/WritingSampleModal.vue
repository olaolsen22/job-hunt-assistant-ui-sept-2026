<script setup lang="ts">
import { LANGUAGE_OPTIONS, type Language } from '~/constants/listing'
import type { WritingSample } from '~/components/profile/WritingSampleList.vue'

// Without `sample` it adds one; with it, it edits that one.
const { sample } = defineProps<{ sample: WritingSample | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const ADD_SAMPLE = graphql(`
  mutation AddWritingSample($input: AddWritingSampleInput!) {
    addWritingSample(input: $input) {
      writingSample {
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

const UPDATE_SAMPLE = graphql(`
  mutation UpdateWritingSample($input: UpdateWritingSampleInput!) {
    updateWritingSample(input: $input) {
      writingSample {
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

const KIND_OPTIONS = [
  { label: 'Cover letter', value: 'COVER_LETTER' },
  { label: 'Other', value: 'OTHER' }
] as const
type Kind = (typeof KIND_OPTIONS)[number]['value']

const TITLE_MAX = 100
const TEXT_MAX = 8000

const title = ref('')
const text = ref('')
const language = ref<Language>('NORWEGIAN')
const kind = ref<Kind>('COVER_LETTER')

watch(open, (isOpen) => {
  if (!isOpen) return
  title.value = sample?.title ?? ''
  text.value = sample?.text ?? ''
  language.value = sample?.language ?? 'NORWEGIAN'
  kind.value = sample?.kind ?? 'COVER_LETTER'
})

const state = computed(() => ({
  title: title.value,
  text: text.value,
  language: language.value,
  kind: kind.value
}))

const validate = () =>
  formErrors({
    title: requiredError(title.value, 'a title'),
    text: requiredError(text.value, 'the text')
  })

const { run, loading } = useMutation(() => emit('changed'))

const submit = async () => {
  const fields = {
    title: title.value.trim(),
    text: text.value.trim(),
    language: language.value,
    kind: kind.value
  }
  const ok = await run(async () => {
    if (sample) {
      const { updateWritingSample } = await gql(UPDATE_SAMPLE, {
        input: { id: sample.id, ...fields }
      })
      return updateWritingSample.errors
    }
    const { addWritingSample } = await gql(ADD_SAMPLE, { input: fields })
    return addWritingSample.errors
  })
  if (!ok) return
  open.value = false
  emit('changed')
}
</script>

<template>
  <AppFormModal
    v-model:open="open"
    :title="sample ? 'Edit writing sample' : 'Add writing sample'"
    description="Past cover letters in the target language teach the AI your style best."
    :state="state"
    :validate="validate"
    :loading="loading"
    @submit="submit"
  >
    <div class="space-y-4">
      <UFormField label="Title" name="title" required>
        <UInput
          v-model="title"
          :maxlength="TITLE_MAX"
          placeholder="Letter to Acme, 2025"
          class="w-full"
          data-testid="writing-sample-title"
        />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Language">
          <USelect v-model="language" :items="[...LANGUAGE_OPTIONS]" class="w-full" />
        </UFormField>
        <UFormField label="Kind">
          <USelect
            v-model="kind"
            :items="[...KIND_OPTIONS]"
            class="w-full"
            data-testid="writing-sample-kind"
          />
        </UFormField>
      </div>
      <UFormField label="Text" name="text" required>
        <UTextarea
          v-model="text"
          :rows="6"
          :maxrows="16"
          :maxlength="TEXT_MAX"
          autoresize
          class="w-full"
          data-testid="writing-sample-text"
        />
        <template #hint>{{ text.length }}/{{ TEXT_MAX }}</template>
      </UFormField>
    </div>
  </AppFormModal>
</template>

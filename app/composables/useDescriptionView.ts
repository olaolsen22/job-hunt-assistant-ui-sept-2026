import type { MaybeRefOrGetter } from 'vue'
import { LANGUAGE_TAGS } from '~/constants/listing'
import type { Language } from '~/constants/listing'

type DescribedListing = {
  description: string | null
  originalDescription: string | null
  postingLanguage: Language | null
}

// Which summary a listing page shows: `description` is always English; `originalDescription` is
// the same points in the ad's language (null for English ads and for listings not re-analyzed
// since it was added). Defaults to English.
export const useDescriptionView = (
  listing: MaybeRefOrGetter<DescribedListing | null | undefined>
) => {
  const view = ref<'en' | 'original'>('en')
  const hasOriginal = computed(() => !!toValue(listing)?.originalDescription?.trim())
  const showOriginal = computed(() => hasOriginal.value && view.value === 'original')
  const text = computed(() => {
    const l = toValue(listing)
    return (showOriginal.value ? l?.originalDescription : l?.description) ?? ''
  })
  const lang = computed(() => {
    const language = toValue(listing)?.postingLanguage
    return showOriginal.value && language ? LANGUAGE_TAGS[language] : 'en'
  })
  return { view, hasOriginal, text, lang }
}

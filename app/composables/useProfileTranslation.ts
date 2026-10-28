import type { InjectionKey, Ref } from 'vue'
import type { Language } from '~/constants/listing'

// `locale` formats the profile's dates in its content language.
type ProfileTranslationState = {
  translating: Ref<boolean>
  target: Ref<Language>
  locale: Ref<string>
  // The one item whose translation is open for editing, if any (see `translationKey`).
  editingKey: Ref<string | null>
  // The next item after this one, in page order, with no translation yet; null at the end.
  nextUntranslated: (key: string) => string | null
}

// Bullets, job titles and education share one editing slot, so Enter can hand on across them.
export const translationKey = (kind: 'bullet' | 'experience' | 'education', id: number) =>
  `${kind}-${id}`

// provide/inject (same as Vue 2): the page owns the mode, and bullets and entry lists deep inside
// read it without every component passing it down as a prop.
const KEY: InjectionKey<ProfileTranslationState> = Symbol('profileTranslation')

export const provideProfileTranslation = (state: ProfileTranslationState) => provide(KEY, state)

export const useProfileTranslation = () => inject(KEY)!

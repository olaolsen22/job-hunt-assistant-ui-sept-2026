import type { InjectionKey, Ref } from 'vue'
import type { Language } from '~/constants/listing'

type ProfileTranslationState = { translating: Ref<boolean>; target: Ref<Language> }

// provide/inject (same as Vue 2): the page owns the mode, and bullets deep inside the four entry
// lists read it without every list passing it down as a prop.
const KEY: InjectionKey<ProfileTranslationState> = Symbol('profileTranslation')

export const provideProfileTranslation = (state: ProfileTranslationState) => provide(KEY, state)

export const useProfileTranslation = () => inject(KEY)!

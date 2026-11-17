import { computed, toValue, type MaybeRefOrGetter } from 'vue'

type ListingTitle = { title: string; company: { name: string } }

export function useListingTitle(
  listing: MaybeRefOrGetter<ListingTitle | null | undefined>,
  section: MaybeRefOrGetter<string> = ''
) {
  useHead({
    title: computed(() => {
      const current = toValue(listing)
      return (
        [toValue(section), current?.title, current?.company.name].filter(Boolean).join(' - ') ||
        'Listing'
      )
    })
  })
}

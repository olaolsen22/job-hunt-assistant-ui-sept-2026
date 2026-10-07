import { COUNTRY_OPTIONS } from '~/constants/countries'

const countryNames = new Map(COUNTRY_OPTIONS.map((option) => [option.value, option.label]))

// "Oslo, Norway", or just "Norway" for a country-only (remote) location.
export const formatLocation = (location: { city?: string | null; countryCode: string }) => {
  const country = countryNames.get(location.countryCode) ?? location.countryCode
  return location.city ? `${location.city}, ${country}` : country
}

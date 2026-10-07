// "Oslo, NO · SE" for a company's locations (the city is optional).
export const formatPlaces = (locations: { city?: string | null; countryCode: string }[]) =>
  locations.map((l) => (l.city ? `${l.city}, ${l.countryCode}` : l.countryCode)).join(' · ')

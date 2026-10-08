// A form's country + city as the API's optional `LocationInput`: no country means no location.
export const locationInput = (countryCode?: string, city?: string) =>
  countryCode ? { countryCode, city: city?.trim() || null } : null

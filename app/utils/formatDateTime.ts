// For DateTime instants (UTC ISO from the API), shown in the user's local zone. Date-only
// LocalDate values go through formatDate instead.
export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('nb-NO', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso)
  )

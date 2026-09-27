// `<input type="datetime-local">` wants local `YYYY-MM-DDTHH:mm`; toISOString() is UTC, so
// shift by the zone offset first.
export const toDateTimeLocal = (value: string | Date = new Date()) => {
  const d = new Date(value)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

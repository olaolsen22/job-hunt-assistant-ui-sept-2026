// The label of an enum value from one of the `*_OPTIONS` lists; undefined for null or unknown.
export const optionLabel = <T extends string>(
  options: readonly { label: string; value: T }[],
  value: T | null | undefined
) => options.find((o) => o.value === value)?.label

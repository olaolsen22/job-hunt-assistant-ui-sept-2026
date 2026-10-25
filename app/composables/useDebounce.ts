// Runs `fn` once the calls stop for `ms`, e.g. while typing a search. A pending call is dropped
// when the component goes away, so a page that's gone never fetches.
export const useDebounce = <Args extends unknown[]>(fn: (...args: Args) => void, ms: number) => {
  let timer: ReturnType<typeof setTimeout> | undefined
  onScopeDispose(() => clearTimeout(timer))
  return (...args: Args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

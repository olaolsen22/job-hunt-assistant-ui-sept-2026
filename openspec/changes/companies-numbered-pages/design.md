# Design

## Context

See proposal.md. `companies` is a cursor connection (`first/after`) with `totalCount`; it has no
`skip`, and `@listSize(assumedSize: 50)` in `schema.graphql` is the server's max page size, so `first`
is at most 50. `/listings` gets numbered pages from `UPagination` with `skip/take`. The companies page
keeps a trail of end cursors for Prev / Next.

## Decisions

1. **Remember the `after` cursor per page.** `cursors[p - 1]` is the `after` value for page `p`
   (`cursors[0]` is `null`). When page `p` loads, its `endCursor` is stored as `cursors[p]` if
   `hasNextPage`. Pages already seen (and the next one) open with a single request. Alternative:
   `first: N * pageSize`. Rejected: `first` is capped at 50. Alternative: decode the cursor to an
   offset. Rejected: cursors are opaque.
2. **Jumping past the known cursors walks forward.** Clicking page `p` with `cursors[p - 1]` unknown
   fetches one page at a time from the last known cursor (each fetch only needs `endCursor`) until
   `cursors[p - 1]` exists, then sets `page`. Sequential requests, accepted: companies lists are short
   and big jumps are rare. Alternative: only show Prev / Next. That is what exists today.
3. **`UPagination`** with `v-model:page`-style handling (`:page` + `@update:page` to run the walk),
   `:total="totalCount"`, `:items-per-page="PAGE_SIZE"`, markup copied from `/listings` and hidden
   when `totalCount <= PAGE_SIZE`; disabled while loading.
4. **The debounce callback resets `page` to 1 and clears `cursors`** together with the settled search,
   as it clears the trail today.
5. **Page size reuses `measurePageSize`** (now with optional row height and gap, defaults unchanged for listings), measured once on mount with the rendered row heights (72 px from `lg`, 132 px below). The first fetch therefore waits for mount, as on `/listings`.
6. **The query keeps a literal `first`**: the document is `print`ed and its `first: 20` placeholder replaced by the measured size. A `$first` variable fails the API cost check (HC0047, priced as 50) at every value.

## Risks / Trade-offs

- A far jump costs one request per skipped page → fine for a personal list.
- A cursor can go stale if companies are added meanwhile → accepted; a search or reload rebuilds them.

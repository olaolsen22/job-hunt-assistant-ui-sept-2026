# Design

## Context

`quick-add.vue` wraps everything in one `UForm` (`@submit="onSave"`), with "Save N listings" as
`type="submit"`. Per-field errors (`name="<key>.<field>"`, `eager-validation`) and `form.validate()`
after a paste depend on the form. The bar shows ghost Cancel/Done (`anySaved`) linking to `/listings`.

## Goals / Non-Goals

**Goals:** no accidental saves, a leave action that can't be mistaken for saving, visible outcome.

**Non-Goals:** route-leave guards, row reordering (see proposal).

## Decisions

- **Keep UForm, drop implicit submit.** Save becomes `type="button"` with `@click="form?.submit()"`.
  UForm's exposed `submit()` validates and then emits `submit`, so `onSave` is unchanged. Browsers
  only submit on Enter when the form has a submit button or a single text field; a row has several,
  so Enter does nothing. Rejected: `@keydown.enter.prevent` on the form (also blocks newlines in the
  paste textareas); dropping UForm (loses per-field validation).
- **Leave action.** `doneCount` / `pending` computeds drive the bar:
  - nothing saved → ghost "Back to listings" (`to="/listings"`) + Save.
  - saved + pending → ghost "Back to listings" as a click that opens `AppConfirmModal`
    ("Leave N unsaved listing(s)?", "Saved listings are kept.", confirm "Leave" → `navigateTo('/listings')`) + Save.
  - saved, nothing pending → Save hidden; solid "View listings" (`to="/listings"`).
    A second `AppConfirmModal` instance next to the remove one keeps both simple (separate open refs).
- **Status line.** At the start of the right-hand group, shown once `doneCount > 0`:
  `i-lucide-circle-check` text-success "N saved", and when rows are pending `i-lucide-circle-alert`
  text-error "M need(s) fixing", `text-sm text-muted`, `size-4` icons. Pending rows after a save are the
  failed or newly added ones; "need fixing" counts rows with an `error`, and unsaved rows without
  an error just stay counted on the Save button.
- **Top summary.** "Check them below, then save." only while rows are pending; otherwise "All saved."
- **Add row** stays visible in every state (manual path), unchanged.

## Risks / Trade-offs

- [Browser back / nav links skip the confirm] → accepted; a route guard is out of scope.
- [`submit()` exposure differs from expectation] → verify in the unit test that clicking Save saves
  and Enter does not.

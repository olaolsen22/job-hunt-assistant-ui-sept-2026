# Design

## Context

See proposal.md for motivation. `/profile` loads `ProfileData` through `useProfile` and has separate mutation-owning edit modals. `listings/ParseModal.vue` provides tabs, prompt copy, paid AI usage, inline parse errors, and busy dismissal protection; it closes directly into a listing form. CV parsing instead returns a typed candidate and needs an unsaved review before an atomic save. Candidate entries and bullet strings have no IDs; IDs exist only in reviewed selection inputs.

The backend schema and its `docs/profile-cv-import.md` are authoritative. `user-profile` gains additive import requirements; existing direct entry/bullet editing and `profile-translations` remain unchanged. Main listing-url-parse specs lag the current modal's From link behavior; this change follows the current paste/external presentation without modifying listing requirements.

## Goals / Non-Goals

**Goals:** Keep all draft edits local, make update identity explicit, and construct a typed selection with omission semantics intact.

**Non-Goals:** Refactor listing parsing, reuse mutation-owning profile editors for unsaved review, or create a generic import framework.

## Decisions

### A dedicated modal with input and review steps

Add a lazy-loaded `ProfileCvImportModal` from the profile header beside Edit. Use `UModal`, `UTabs`, `UFormField`, `UAlert`, and the existing button/spacing conventions. Input tabs are Paste CV and Use your own AI; the latter copies instructions without demanding CV text, then accepts JSON. Preserve input across route switches and failures. Built-in parsing uses the paid AI notice and `useLlmUsage` refresh pattern. Back from review preserves edits; replacing an existing review or dismissing it asks through `AppConfirmModal` before discarding.

Inline ui-ux-expert review recommends one scrollable, sectioned review inside a wider modal, with collapsible history cards, labeled selection controls, warning paths near fields, and a persistent footer showing selected counts and Save import. Phone controls stack; larger layouts put related structural fields in two columns. Keep long text wrapped, controls labeled, and errors visible in light/dark mode. An empty review offers Back and disables Save. A separate page would disrupt the requested modal flow; directly applying candidate values would hide the save selections.

### Typed CV operations and local draft state

Run `pnpm gql:gen` first during apply. Add `useProfileCvImport` with literal GraphQL documents for prompt, parse, preview, and import, using `gql` and `ResultOf`/schema-derived variable types. Select all supported candidate fields and warnings; reuse `PROFILE_FIELDS` for the save response. Parse results are synchronous `SUCCEEDED`/`FAILED`, not listing parse jobs or SSE. API/transport errors return to the modal; use existing error and mutation conventions where they allow inline correction. Do not extend `useParsePrompt`'s listing parse-mode map, because these operations have different result contracts.

Use a focused selection utility for draft initialization, validation, and serialization. It must distinguish excluded properties, retained values, and explicit clears; do not spread a candidate wholesale into save input. Review covers supported fields only, excluding preferences, references, sensitive personal fields, and translations.

### Manual identities and safe omission

Refresh the profile before constructing review updates. Default history rows/bullets to Add; Update requires a same-kind entry picker, and bullet Update requires a same-parent picker. Reject repeated target IDs in the selection. Changing parent clears bullet update targets. Display current values beside incoming values; initialize update structures from the selected existing entry, overlay available candidate values, and let the owner edit/explicitly clear retained optional fields. Send complete structural values for updates, since omitted optional structural fields clear them. Add sends no ID; Skip sends no row. No similarity scoring or inferred IDs.

Basics use individual include controls; absent candidate values start excluded and optional clears are explicit. Links and hobbies start excluded and require a visible replacement opt-in; initialize the editable replacement from current values plus candidate values so retained items can be reviewed, removed, or cleared explicitly. Skills/languages use include/skip and their API name/language upsert semantics, showing existing levels. Entry skill tags can create missing skills at level 1; explain that behavior. Existing unselected bullets remain untouched and no import delete/reorder controls are offered.

### Warnings, validation, and one save

Keep server warnings as source-review notices with paths; distinguish them from current form errors so corrected values are not blocked by historical warnings. Require valid selected required names, month values, skill levels 1–5, CEFR levels, location and link values, and contract collection limits. Use existing month, location, name-chip and level controls/utilities where suitable (`ProfileLocationField`, `ProfileNamesField`, `AppMonthField`, existing constants); mutation-owning history modals and `ProfileBullets` cannot edit local drafts without saving, so reuse their field conventions in review components instead.

Show null end-month interpretation explicitly and require the owner to confirm current/ongoing where applicable. Send `contentLanguage: ENGLISH` and one `importProfileCv` request only from Save import. Disable duplicate submission/dismissal while busy. Success emits returned `ProfileData` to the page's `onSaved` pattern and closes. Failure retains draft state; unknown-ID errors refresh target options without resetting edits. Norwegian-primary import is disabled with guidance to the existing language control, never an implicit language mutation.

## Risks / Trade-offs

- Repeated Add creates duplicates → manual choices, selected counts, double-submit prevention, and close on confirmed success; do not automatically retry an uncertain save.
- Concurrent edits can change an update target → refresh before review, show retained values, preserve draft on errors; the API has no optimistic concurrency token.
- Warnings may describe values since corrected → present them as original parse warnings alongside live validation.
- List replacement or missing optional update values can lose data → explicit replacement opt-in and fully reviewed structural update values.
- English changes can stale Norwegian translations → preserve translation records and use existing stale indicators after save.

## Migration Plan

No persisted UI migration or new dependencies. Generate schema types, add operations and UI, verify focused behavior tests/lint/typecheck/build, and leave the production preview running per project rules. Rollback removes the new UI entry point and import files without altering imported backend data. Live/E2E verification requires separate explicit authorization.

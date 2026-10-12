# Design

## Context

See proposal.md for the motivation and specs/ for the behavior. Relevant existing code:

- `app/pages/listings/[id]/index.vue` renders `<ListingsApplication>`, which opens `ApplyModal.vue`.
- `useProfile` already fetches the profile with entry and bullet ids, and the draft source ids come from there.
- `CvImportModal.vue` and `useProfileCvImport` already provide copy prompt, the manual prompt fallback, JSON paste
  with a size limit, and preview. `useParsePrompt.ts` may already be a generic copy-prompt helper.
- `useMutation` handles mutation loading and error display. `AppConfirmModal` is the standard confirmation.

## Goals / Non-Goals

**Goals:** keep draft logic testable as plain functions, so components only render; send one request at a time so
progress is real; never lose edits.

**Non-Goals:** using the single `analyzeAllTailoredCv` request, a draft history, PDF output, SSE.

## Decisions

1. **Full page, not a modal.** The draft is long and editorial, and the route can be linked from the card and the
   Apply modal. Alternative: a phone-fullscreen modal like CV import. Rejected because a page handles the unsaved-leave
   guard and deep linking more naturally.
2. **Client-side loop of `analyzeTailoredCvSection`** instead of `analyzeAllTailoredCv`. Each response updates the
   overlay step text and fills in its section, and failures stay inside their section. The cost is N requests, the
   same as the server runs. When SSE arrives, only the progress source changes.
3. **Pure helpers in `app/utils/tailoredCv.ts`**: build a candidate from the profile, apply an analysis result to a
   section (keep only the selected bullet and skill ids, in profile order, and replace the summary), convert to
   `TailoredCvContentInput`, and render plain text. A composable `useTailoredCvDraft(listingId)` owns the draft
   query, the candidate, the dirty flag (a JSON snapshot compared to the last saved or seeded state), pending
   suggestions, analysis progress and save.
4. **Suggestion model**: a map from section key (`summary`, `skills`, `experience:<sourceEntryId>`) to suggested
   content. Results apply directly only on first creation, when there is no saved draft and no edits; otherwise they
   become suggestions. The external preview uses the same rule, per section, while keeping the current contact fields.
5. **Draft existence on the listing page**: the page fetches `tailoredCvDraft` once, through `useAsyncData` with a
   listing-keyed key and only the fields the card needs plus content for copying. It passes `hasDraft` to the card and,
   through `ListingsApplication`, to `ApplyModal`. This avoids a second fetch in the modal.
6. **Overlay**: a fixed full-screen layer with Tailwind `backdrop-blur-sm` and a `bg-default/60` tint, plus a
   centered spinner icon (`i-lucide-loader-circle animate-spin`) and step text with `role="status"` and
   `aria-live="polite"`. Built-ins only, with no new CSS.
7. **Leave guard**: `onBeforeRouteLeave` opens `AppConfirmModal` when the candidate is dirty, plus a client-only
   `beforeunload` listener while analysis runs or the candidate is dirty, so closing or reloading the tab triggers the
   browser's leave-page warning.
8. **Editors**: reuse the existing form patterns, `UFormField`, `UInput`, `UTextarea` and `AppMarkdownEditor` where
   the profile uses it, inside listings components. Reuse a profile review component only if its props fit the
   tailored types without coupling to CV-import types. Otherwise build simple section editors; a shared
   abstraction needs two real uses.

9. **One AI choice modal** (`ListingsTailoredCvAiModal`) for every scope: built-in (usage, request count, Analyze)
   or external (copy prompt, paste, Preview). The prompt loads with the page, so Copy is a direct clipboard write.

## Risks / Trade-offs

- [The external prompt is whole-CV only] → A section's external choice copies the same prompt and keeps only that
  section of the reply.
- [Long analysis blocks the page] → The overlay shows the step, and finished sections keep their results if a later
  call fails.
- [The profile changes after a draft is saved] → The draft is a snapshot by design. Re-analyze offers new
  suggestions.
- [Dirty check via JSON snapshot] → Simple and enough for a draft of this size.

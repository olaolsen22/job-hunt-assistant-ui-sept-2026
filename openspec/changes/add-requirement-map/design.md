# Design

## Context

See proposal.md for motivation. The API contract is fixed (`docs/requirement-map.md` in the API repo, checked
against `schema.graphql`): `requirementMap(listingId)` is null until saved; `generateRequirementMap` and
`previewRequirementMap` return an unsaved, already-corrected candidate; `saveRequirementMap` is a strict full
replace; `deleteRequirementMap` removes it. Generated types already contain these operations; executable UI integration is
absent. Type generation reads the sibling schema file, so a successful generation does not verify the running API.
The owner reports restarting the API; confirm endpoint compatibility with a read-only request during apply.

The cover letter is the closest existing flow: a card on the listing page, a dedicated editor page with
`AppSaveBar` and a leave confirm, and an AI modal with built-in and own-AI tabs. The inline UX and reuse review supports retaining these patterns. Use a dedicated editor for the long review,
keep candidate replacement reversible, and reuse the existing AI safeguards rather than extracting a new framework.

## Goals / Non-Goals

**Goals:**

- Follow the cover letter and question-answer patterns so no new shared abstraction is needed.
- Keep the card readable at 375 px: counts first, then only the needs that drive the decision.

**Non-Goals:**

- No extraction of the dirty/discard logic from `useCoverLetterDraft` (it is tied to letter prefill).
- No per-run model picker; `model` is omitted so the saved default applies.

## Decisions

1. **Card plus page, not a modal.** Up to 30 needs with evidence pickers is too much for a modal, and card → page
   matches the CV and cover letter. Route: `app/pages/listings/[id]/requirements.vue`. For Saved listings, place
   the card after Summary and before Tailored CV. For other statuses, place it after Application and before
   Tailored CV in the existing upper workflow block. Render exactly one card at every viewport; do not move the
   application-first workflow. This resolves the original plan's impossible ordering for active applications.

2. **One composable, `useRequirementMap(listingId)`**, modelled on `useApplicationAnswerAi.ts` for the AI side and
   `useCoverLetterDraft.ts` for the editor side:
   - `useRequirementMapQuery(listingId)`: `useAsyncData`, key `requirement-map-<id>`, `server: false`,
     `dedupe: 'defer'`, shared by the card and the page.
   - AI: `useAiRequest().run(...)` for `generateRequirementMap` (request id reuse, retry confirm, unknown-model
     refresh, `AiSafetyError` code). Accept `result.content` only on `SUCCEEDED`; on `FAILED` show `error` and
     `errorCode`. Omit optional `model` to use the default; send `requestId`. Use `useAiPrompt` for
     `requirementMapExternalPrompt`, `preview(json)` returning
     `{ value }` or `{ error }`.
   - Editor state: `needs` ref plus an explicit pending-candidate flag, with a normalized saved baseline and a
     pre-candidate snapshot (including its dirty state) for Discard. A candidate stays unsaved even when its needs
     equal the saved content; JSON equality alone is insufficient. Confirm replacement before charging for another
     run or previewing over edits. Failed/cancelled attempts retain the existing editor and pasted reply.
   - Query all need fields and timestamps on reads and saves. Use `useMutation().run` for save/delete; on success
     adopt the full API response, clear pending state and update the shared map query. Invalidate/revalidate on
     navigation so mounted or cached cards cannot keep a deleted map. Late query/profile refreshes must not
     overwrite local edits. An API failure leaves the editor, dirty state and saved cache intact.
   - Alternative considered: extracting a shared draft-editor composable. Rejected; the cover letter's version is
     interleaved with its header prefill, and a snapshot compare is a few lines.

3. **AI modal copies `QuestionAiModal.vue`**: `useAiModalState`, `AppAiModal`, `AppAiMethodTabs`,
   `AppAiCostNotice`, `AppAiRetryConfirm`, `AppAiErrorAlert`, `AppAiOwnSteps` (keeping its note about copying the
   prompt again when a reply says it is out of date). The modal emits the candidate; the page loads it. The prompt
   is fetched on each open because it depends on the listing and profile. Copy the API's instructions unchanged;
   paste help says "Paste the JSON object without code fences; it must include schemaVersion: 1." Send the reply
   to preview rather than constructing a candidate locally. Both paths load only the returned corrected content,
   preserving need order and strongest-first bullet order; inform the user that unknown ids may have been removed,
   matches without evidence or a note become gaps, long text is cut and needs beyond 30 are dropped. Do not reimplement the AI
   correction algorithm in the UI. GraphQL prompt failures and payload validation failures are separate error paths.

4. **Need rows are edited inline, evidence in a modal.** `ListingsRequirementNeedRow` shows text, kind, importance
   and match controls, the note, and evidence chips; `ListingsRequirementEvidenceModal` is a checklist of bullets
   grouped under their entry plus the entries themselves, with a "n of 10" counter per list. Rows use Nuxt UI
   `USelect`/`UTextarea` with `maxlength` for the 200/500 limits.

5. **Evidence lookup extends `app/utils/profileBullets.ts`** with `profileEntries(profile)` (Map keyed
   `<KIND>:<id>` over experiences, educations, certifications, projects), sharing one entry-name function with
   `profileBullets`. Unknown ids are filtered when a map or candidate is loaded into the editor, so they are neither
   shown nor re-sent; the API would reject them on save anyway. Wait for profile resolution before filtering; a
   profile load failure is an error with Retry, not an empty profile. Filter the baseline and editable projection
   consistently so filtering alone does not mark it dirty. Recheck membership before save against the loaded
   profile. If stale ids remove the last support from an evidenced/partial need with no note, keep its match and
   show the validation issue; do not silently relabel an existing saved need as GAP. The API still owns concurrent
   profile changes and its errors are displayed. Key entries by kind and id to avoid collisions.

6. **`app/utils/requirementMap.ts`** holds the pure parts so they are testable without mounting: the `ResultOf`
   types, `toRequirementMapInput` (gap → no evidence, Language/Practical → no ids, blank note → null),
   `needIssue(need)` for the pre-save checks, `matchCounts`, `needsToReview` (gap and partial, required first, gaps
   before partial), and label/icon/color maps for kind, importance and match.

7. **Validate the normalized save payload, not just controls**: 1–30 needs; nonblank text of at most 200
   characters; note at most 500; at most 10 bullet ids and 10 entry refs per need, all in the current profile.
   Evidenced/partial needs require evidence or a nonblank note; Language/Practical have no ids and require a note.
   Gap payloads have empty evidence lists (a note is optional). Controls guide entry but cannot replace validation
   of loaded candidates or saved data. Show field errors and focus the first invalid need on Save. API errors
   appear above the save bar and retain user input; do not silently truncate manual edits to make them save.

8. **Out-of-date hint** compares the map's `updatedAt` with the listing's `updatedAt` (to be added to the listing
   detail query), as the API guide suggests.

9. **Naming.** The card is "Requirements", the action "Map requirements" / "Edit". "Analyze" is avoided because
   the header's "Analyze ad" is the ad parser.

10. **Responsive review.** Stack labeled need fields on phones, use modest field columns only when the shell's
    available width permits on tablet/desktop, and keep long evidence labels wrapping. The evidence picker follows
    phone-fullscreen modal conventions with reachable Cancel/Apply and independent 10-bullet/10-entry counters.
    Cancel retains the row's evidence; applying preserves existing bullet order and appends new choices. Sticky
    save controls and validation messages must remain reachable with a short viewport and the on-screen keyboard.

**Deliberate scope choices:**

- Keep generation available when the listing has no description and no skills;
  the API's error is shown in the modal: the API owns that rule, and both paths already report it.
- Keep the existing "Analyze ad" parser action unchanged; "Map requirements" identifies the separate workflow.

## Risks / Trade-offs

- [Listing `updatedAt` may also move on changes that do not affect the ad, such as status or favorite] → the hint
  is worded as "may be out of date" and is only a hint; check during implementation and drop it to a muted line if
  it fires on every status change.
- [An unsaved candidate is lost on reload] → the unsaved notice and the leave confirm say so; built-in runs cost
  money, so the browser's unload prompt is kept while dirty, as on the cover letter page.
- [Evidence modal on a profile with many bullets is long on a phone] → group by entry, phone-fullscreen modal as
  other form modals; no search field unless it proves necessary.
- [Client checks drifting from the API's] → explicit boundary tests cover all published save rules; API errors
  remain authoritative and are always shown.
- [Restarted API differs from the schema file] → verify the six operation signatures with a read-only schema
  request through `/graphql` during apply; if introspection is disabled, report the limitation and use a normal
  authenticated requirement-map read. Never call a paid generation merely to check availability.

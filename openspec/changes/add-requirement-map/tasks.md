# Tasks

## 1. Contract and implementation preparation

- [x] 1.1 Run `pnpm gql:gen` against the current sibling schema; record any generated diff and verify the six
      operation signatures and four requirement enums. Types already exist; generation alone is not implementation.
- [x] 1.2 Check the restarted API through same-origin `/graphql` with read-only introspection for the six operation
      signatures, or an authenticated requirement-map read if introspection is disabled. Record actual results and
      any unverified operations; do not call paid generation or mutate saved data to check availability.
- [x] 1.3 Complete the major-change preparation from `CLAUDE.md`: record this API message and contract findings,
      build preview and capture the existing listing page at 375/768/1440 in light mode (guest or mocked data),
      then obtain the required UX/reuse advice before coding. The new editor needs no before screenshot. Verify
      recommendations respect the two listing-status branches and record any deviations.

## 2. Evidence and validation

- [x] 2.1 Extend `app/utils/profileBullets.ts` with `profileEntries(profile)` keyed by kind and id; add tests for
      all four entry kinds, colliding numeric ids across kinds, missing ids, and preserved bullet order.
- [x] 2.2 Add `app/utils/requirementMap.ts` with types derived from executable GraphQL documents via `ResultOf`,
      payload normalization, validation, counts and review ordering. Tests must permit 1/30 needs, 200-character
      text, 500-character notes and 10+10 evidence refs; reject 0/31 needs, blank/201-character text,
      501-character notes and 11 refs of either kind; cover evidence-or-note, whitespace-only notes,
      Language/Practical without ids, Gap evidence stripping, and stale ids removing the last supporting evidence.
- [x] 2.3 Update the inventory and reusable documentation for the evidence helper once implemented; verify every
      documented export exists and distinguish stale ids from a failed or unresolved profile request.

## 3. Data and unsaved state

- [x] 3.1 Implement all six executable documents in `app/composables/useRequirementMap.ts`, full need selections
      on read/save, and the shared `requirement-map-<id>` query. Use existing `gql`, `useMutation`, `useAiPrompt`
      and `useAiRequest` helpers. Tests must cover null read, SUCCEEDED content, FAILED error/errorCode,
      payload errors, prompt GraphQL errors, omitted model/default behavior and requestId transport retry reuse.
- [x] 3.2 Implement editor baseline, explicit pending-candidate state, replacement confirmation, pre-candidate
      Discard snapshot, strict save and delete. Tests must prove identical candidates are still unsaved,
      cancelled replacement sends no AI request, neither AI path saves implicitly, server-corrected content is used,
      failed requests preserve edits, save fully replaces/adopts the response, and delete clears shared saved state.
- [x] 3.3 Resolve evidence only after profile success, filter stale ids consistently in baseline and editor,
      revalidate before save, and protect edits from late query/profile refreshes. Tests must cover profile Retry,
      no false dirty state from filtering, loss of last evidence requiring correction, and refresh during editing.
- [x] 3.4 Add listing `updatedAt` to `useListing.ts`; test stale/equal/newer timestamp comparisons for the map hint.
      Document the new composable and query behavior in the inventory/reusables with verified paths.

## 4. AI review and editor

- [x] 4.1 Build `ListingsRequirementMapAiModal` with the existing shared AI components. Test built-in and own-AI
      success using API-corrected candidates, failed results/payload errors, charged-retry confirmation,
      no-description/no-skills generation error and prompt GraphQL error. Paste help must require a JSON object
      without fences and `schemaVersion: 1`; test API rejection of missing/wrong versions, malformed JSON, unknown
      enums and empty needs, retaining the pasted reply and existing editor content.
- [x] 4.2 Build `ListingsRequirementNeedRow` and `ListingsRequirementEvidenceModal` with labeled fields and
      independently capped bullet/entry choices. Component tests must cover both eleventh-choice limits,
      Language/Practical notes, changing kind/match clearing outgoing evidence, Gap behavior, wrapping labels,
      and picker Cancel preserving the previous selection.
- [x] 4.3 Build `/listings/[id]/requirements` with loading/error/empty states, candidate notice and Discard,
      add/remove needs, field-level validation, first-error focus, `AppSaveBar`, navigation/reload protection,
      confirmed delete and stale hint. Page tests must cover successful full replacement, invalid save not sent,
      API validation error retaining edits, discard restoring prior unsaved work, leave cancellation,
      delete cancellation/success/failure and return to the listing.
- [x] 4.4 Build/restart preview before taking editor screenshots at 375/768/1440 in light mode with mocked saved,
      candidate, empty and validation-error states; check long content, reachable picker/save controls and no page
      overflow, including a short viewport. Record screenshot paths and any unverified keyboard behavior.
- [x] 4.5 Update the inventory and reusable component documentation; verify names and props match implementation.

## 5. Listing integration

- [x] 5.1 Build `ListingsRequirementMapCard` with null/loading/error/retry states, match counts, ordered gap/partial
      needs, Edit and stale hint. Test empty, all-evidenced and mixed maps; prove unsaved candidates do not change
      the card and save/delete updates survive navigation through cached query state.
- [x] 5.2 Integrate exactly one card in each status branch: Saved = Summary → Requirements → Tailored CV;
      other statuses = Application → Requirements → Tailored CV. Extend listing page tests for both branches
      and ensure the existing Analyze ad parser action is unchanged.
- [x] 5.3 Rebuild preview and capture listing screenshots at 375/768/1440 in light mode for Saved and active
      applications with and without maps. Compare before/after order, long need labels and single-card rendering.
      Run `log-progress` for `docs/STATUS.md` and verify it describes implemented behavior only.

## 6. Integration checks

- [x] 6.1 Run relevant unit tests, `pnpm lint` and `pnpm typecheck` after a coherent implementation batch; run the
      full unit suite if shared-helper changes warrant it. Record commands/results and fix confirmed failures.
      Do not run E2E without explicit authorization.
- [x] 6.2 Complete the required `ui-reviewer` review of the diff and before/after screenshots; fix confirmed issues
      and report remaining limitations. Check every requirement-map spec scenario against implementation evidence.
- [x] 6.3 Build/restart final preview with `echo '{}' | .claude/hooks/preview.sh`; verify build success and report
      unit/static checks, screenshot status, live API compatibility results and E2E status separately. Serving a
      preview or validating OpenSpec files does not prove the feature works.

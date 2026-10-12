# Design

## Context

See proposal.md for the problem and dependency on `import-profile-cv`. Source review confirms that `CvImportModal.vue` disables Save when `review.errors.length` is nonzero and its handler silently returns for invalid input. `createCvDraft` retains null skill levels, which validation then rejects. `CvReview.vue` prints raw paths in two top-level blocks and repeats history warnings above entries; its `UFormField` controls have no inline error bindings. `CvEntryReview.vue` initially opens every full form. The existing modal test explicitly expects disabled Save for missing levels, so passing tests did not establish usable recovery.

A separate `ui-ux-expert` agent inspected the components, utility, tests, and reuse documentation read-only. It recommended actionable Save, field-local feedback and focus, level 1 defaults with existing-level retention, deduplicated resolved warnings, footer save-failure feedback, and compact history summaries. This design adopts those findings. No browser or E2E review was run.

## Goals / Non-Goals

**Goals:** Make every invalid Save attempt lead directly to a correction, reduce avoidable skill-level work, and keep meaningful feedback where the owner can act on it.

**Non-Goals:** Backend validation changes, a general-purpose error framework, guessing dates or CEFR proficiency, or changing atomic/import identity and omission semantics.

## Decisions

### Save validates and guides rather than becoming inert

Disable Save only while busy or nothing is selected, with an adjacent explanation for the empty state. An invalid click sets submission-attempt state, displays local errors, announces “Check 3 fields before saving” beside Save, expands the affected entry, and scrolls/focuses its first control after rendering. Never send `importProfileCv` with locally invalid selections. On valid submission show Saving and preserve double-submit protection. Keep all form values when validation or requests fail.

The owner reports that disabled buttons look too similar to enabled buttons and explicitly requests a styling correction without additional labels. Make disabled Save visibly distinct using the existing neutral/muted theme tokens for its background, border and foreground, and suppress enabled hover/active treatment. Do not rely only on a small opacity reduction or add explanatory labels to compensate. Keep standard disabled semantics and the existing loading indicator. Invalid selected content keeps a normally styled, actionable Save button; the stronger disabled styling applies only when the action is actually unavailable. Scope any justified style override to the CV import button rather than changing buttons throughout the app.

Reuse the existing persistent footer and `UFormField :error` bindings. Track errors internally by field keys; let each review component register its actual focus target and ancestor-expansion action. Month pairs focus their first relevant input, action/target errors focus their picker, and entry/list errors focus an actionable summary or selection control. Focus stays inside the modal and targets are derived from rendered order. After the first attempt, revalidate edited fields so their errors clear promptly. Initial missing/uncertain source values use local guidance rather than painting the whole form red. Continuing to disable Save was rejected because it prevents recovery feedback at the point of intent.

### Visible missing-skill defaults

In `createCvDraft`, initialize a missing skill level from the profile's same normalized name (trim and case-insensitive), otherwise 1. Preserve valid supplied levels and user edits. A short note such as “No level in the CV; using level 1. You can change it” appears once beside a defaulted skill; existing-level reuse says “Keeping your saved level.” Renaming a skill does not silently overwrite an already edited level. No separate checkbox acknowledgment is needed; the displayed value is reviewed with the rest of the selection. This name lookup uses existing skill upsert semantics and introduces no automatic history-entry/bullet matching.

The backend documentation specifies 1–5, so 0 cannot serve as an unknown/default value. Null levels create unnecessary per-skill tasks. Do not autofill missing dates or language proficiency. Invalid explicit supplied levels remain correctable inline rather than being silently normalized away.

### One feedback model, local presentation

Keep `reviewCvSelection` as the authority for local validity, using internal path keys plus plain correction messages. Attach errors to fields in `CvReview` and `CvEntryReview`, including basics location, links, hobbies, history structure/action/targets, bullets, standalone skills and languages. Collection or parent-level constraints appear once at the corresponding section or entry. Use examples such as “Choose the saved experience to update,” “This experience is already selected for an update,” and “Choose a country,” without array indices or terms such as upsert, selection, or wrong-parent IDs in primary messages.

Remove the original-warning wall and the separate validation list at the top. Associate each known warning with the field it describes; when live validation covers the same problem, show one message. Stop showing missing-level warnings after a valid default and retire actionable warnings when corrected or skipped. Do not merely remove all warnings on any edit: source ambiguity can remain relevant even if the edited value is structurally valid. Preserve unknown-path or non-actionable source notes in a collapsed Import notes disclosure, labeled in human terms where possible, with raw details only on demand. The footer provides status and correction navigation, never a second detailed list.

### Preserve API explanations without forcing technical paths on the owner

`useProfileCvImport.save` currently joins payload messages into one string, losing their independent locations. Preserve structured typed errors and parse recognizable selection paths only to route them. Build the path-to-draft map alongside serialization: omitted/skipped rows and bullets change request indices, so a server path must resolve through the sent selection rather than index the full draft. Translate the known field context to its label and keep the useful backend reason. Clear an inline server error when its field is changed, not when unrelated input changes.

Unknown/foreign target errors refresh choices and ask for reselection beside the target picker when identifiable. Unmapped errors and network failures appear beside Save with understandable guidance and optional original details. Preserve the existing warning against automatically retrying an uncertain Add response; never claim a failed network response proves nothing saved. No guessed error routing to the wrong row and no blanket removal of backend explanations.

### Compact review and responsive layout

Keep the existing modal, section order, field controls (`AppMonthField`, `ProfileLocationField`, `ProfileNamesField`) and mobile-first grids. Change complete history entries to collapsed summaries showing employer/title, school, certification or project name with readable action labels. Place the action choice and needs-attention indicator where they remain visible when collapsed. Entries already needing review may start open; an invalid Save always opens the correction target. Existing data comparison and edit controls remain inside the expanded entry.

Keep a single-column layout on phones, two related field columns from `sm`, wrapping text, touch-sized controls and labeled errors. Simplify repeated explanations, keep replacement consequences beside the affected list opt-in, and retain one concise unsaved-review note. A new page, wizard or additional navigation system would add scope without addressing the current failure.

## Risks / Trade-offs

- Defaulting missing skills can lower existing proficiency → retain existing levels and make the displayed default explicit before saving.
- Backend paths refer to filtered request arrays → capture a submission-specific map for entries and bullets, including skipped rows.
- Clearing warnings may hide source uncertainty → distinguish current validation from source notes and keep unresolved ambiguity local or in Import notes.
- Error targets can be hidden or compound controls → open ancestors before focusing and test actual visible focus, including month inputs and target pickers.
- The prior CV requirements are not in main specs yet → sync/archive `import-profile-cv` before syncing/archiving this change; do not silently merge conflicting deltas.

## Migration Plan

No persisted data or schema migration. Replace the review feedback/default behavior in the existing components and update the tests that currently expect disabled invalid Save. Check focused tests, lint, typecheck, build and production preview during apply. Browser/E2E checks remain separately authorized; source/unit review must not be described as a live UX check. Rollback restores the old presentation without altering imported profile records.

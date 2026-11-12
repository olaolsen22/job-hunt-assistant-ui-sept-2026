# Tasks

## 1. Standard toast kinds

- [x] 1.1 Replace `SUCCESS_TOAST_DURATION` in `app/constants/ui.ts` with a `TOAST_DURATION` map
      (success 4000, info 5000, error/warning/undoable 8000). Add `app/composables/useAppToast.ts`
      with `success`, `error`, `warning`, `info` and `undoable`: fixed color and icon per kind, one
      neutral outline `md` action, and `id` defaulting to `<kind>:<title>`. Check how `add` behaves
      with an existing id and dedupe if needed (design 3). Verify with a new
      `test/unit/useAppToast.test.ts` that checks color, icon, duration and action style per kind,
      that Undo calls the callback, and that a repeated message leaves one toast.
- [x] 1.2 In `app/app.vue` set the toaster to `bottom-right`, `progress: false`, `max: 3`. In
      `app/app.config.ts` add `ui.toast.defaultVariants.color: 'neutral'` if the theme accepts it
      (design 4). Verify with `pnpm typecheck`.

## 2. Migrate call sites

- [x] 2.1 Route the shared helpers through `useAppToast`: `useMutation`,
      `useDuplicateListingToast`, `useParsePrompt` (`toastError` and line 124), `useCopyAsText`,
      `useDeleteListing`, `useBaseCvs`, `useCoverLetterDraft`, `useTailoredCvDraft`. Remove
      `useSuccessToast` and move its users to `useAppToast().success`
      (`rg -n "useSuccessToast" app` returns nothing). Verify with
      `pnpm vitest run test/unit/ListingSaveNavigation.test.ts test/unit/TailoredCvPage.test.ts`.
- [x] 2.2 Migrate the component and page call sites: FavoriteButton, StatusTimeline,
      TailoredCvPdfModal, cv/ContentEditor (removal → `undoable` with the trash icon, "Groups
      suggested" → `undoable`), cvTemplates/Editor and AiDraftModal (info),
      cv-templates/[id].vue and new.vue, listings/add.vue, listings/imports.vue,
      listings/[id]/cv.vue, skills.vue. Apply the copy rules: sentence case, no trailing full stop,
      name the item. Make "Save or discard your changes first" and "Save a version in another
      language first" warnings. `rg -n "useToast\(\)" app` should list only `useAppToast.ts` and the
      PWA plugin. Verify with
      `pnpm vitest run test/unit/CvTemplatePage.test.ts test/unit/CvTemplateNewPage.test.ts test/unit/StatusTimeline.test.ts test/unit/FavoriteButton.test.ts`,
      updating only assertions whose titles changed on purpose.
- [x] 2.3 In `listings/RowActions.vue`, title the archive toast `Archived <title>` with Undo, and
      make Unarchive and the Undo result a plain success with no action. Add a test that archiving
      offers Undo and that unarchiving does not (in the existing listings test that mounts
      RowActions, or a new `test/unit/RowActions.test.ts`).
- [x] 2.4 In `plugins/pwa-update.client.ts`, keep `id`, `duration: 0` and the solid primary Reload,
      and only remove leftover per-button overrides if there are any. Verify by reading the file
      and with `pnpm typecheck`.
- [x] 2.5 Copy as text: show `copied` on the CoverLetterCard and tailored CV copy buttons (check
      icon and "Copied"), and drop their success toasts. Keep the error toast. Verify with a test
      that the button shows "Copied" after a successful mocked clipboard write and that no toast
      was added.
- [x] 2.6 Update `docs/REUSABLES.md` and `.claude/state/ui-inventory.md` (`useSuccessToast` →
      `useAppToast`, and the toast notes for `useMutation`/`useCopyAsText`). Verify with
      `rg -n "useSuccessToast" docs .claude/state`, which should return nothing.

## 3. Clear sticky bottom bars

- [x] 3.0 Add `useToastClearance` and use it in SaveBar, quickAdd/Actions, skills.vue,
      companies/index.vue and profile.vue. Add the clearance to the toaster's bottom offset in
      `app.vue`. Verify with typecheck and lint, and with screenshots of a toast above the skills
      bulk bar at 375 and 1440 (task 4.2).

## 4. Verify

- [x] 4.1 Run `pnpm test`, `pnpm lint` and `pnpm typecheck` (shared change), then rebuild preview
      with `echo '{}' | .claude/hooks/preview.sh`.
- [x] 4.2 Update `/tmp/claude-1000/toast-shots/shots.cjs` to the new titles. Add one shot over the
      profile save bar and one over the skills bulk bar. Take the after screenshots at 375/768/1440
      in light mode and compare them with the before shots. If a toast hides a needed bottom
      action, apply the design's risk mitigation and reshoot.
- [x] 4.3 Run `ui-reviewer` on the diff with the before and after screenshots. Fix confirmed
      issues and report the rest. Then update `docs/STATUS.md` with `log-progress` and the work
      log.

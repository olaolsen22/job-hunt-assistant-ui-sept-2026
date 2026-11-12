# Design

## Context

- `app/app.vue` sets `<UApp :toaster="{ position: 'top-right' }">`. Every other toaster option is
  the Nuxt UI default: 5 s duration, progress bar on, expanded stack, max 5.
- Nuxt UI's toast defaults to `color: 'primary'` (green), so any call site that omits `color`
  renders as a success.
- `useSuccessToast` is the only helper. About 25 call sites call `useToast().add` directly with
  their own color, icon and action styles.
- The before screenshots are in the session scratchpad, `/tmp/claude-1000/toast-shots/before-*`.
  They cover a real Archive → Undo flow on the guest listing, plus copies of real call-site configs
  pushed into the toast state. The script `shots.cjs` there can be rerun for the after shots.

## Goals / Non-Goals

**Goals:**

- One place decides a toast's color, icon, duration and action style, so a call site states only
  the kind, the message and an optional action.
- Global behavior (position, progress, max) is set once on the toaster.

**Non-Goals:**

- No custom toast component, no new packages, and no changes to Nuxt UI's swipe, hover or a11y
  behavior.
- No inline-alert conversions (see the proposal's out of scope).

## Decisions

1. **Toaster props in `app.vue`:** `position: 'bottom-right'`, `progress: false`, `max: 3`, and
   `expand` stays at its default.
   - At 375px the viewport is already full width minus margins (seen in the screenshots), so
     bottom-right gives the phone layout with no theme override.
   - ui-ux-expert suggested bottom-center on phones through a viewport class override. It is not
     needed, because bottom-right already spans the width on phones.

2. **One composable, `useAppToast()`, in place of `useSuccessToast`.** It returns
   `{ success, error, warning, info, undoable }`. Each takes a title and an optional
   `{ description, action, icon, id }`, and calls `useToast().add` with the kind's color, icon and
   duration.
   - The durations live in `constants/ui.ts` as one `TOAST_DURATION` map that replaces
     `SUCCESS_TOAST_DURATION`.
   - It accepts a single action and applies the standard style: `color: 'neutral'`,
     `variant: 'outline'`, size `md`.
   - `undoable(title, onUndo, { icon })` builds the Undo action.
   - ui-controller (option c) and ui-ux-expert both recommended this. app.config alone can't vary
     the icon or duration per kind.
   - Alternative rejected: keep `useSuccessToast` and add siblings. That keeps the misleading name
     and spreads the kinds over several files.

3. **Dedupe:** each toast gets `id: <kind>:<title>` unless the caller passes an id, so the same
   message replaces the visible copy instead of stacking. Check the installed `useToast().add`
   behavior with an existing id (update vs. duplicate) during implementation. If it duplicates,
   the composable removes the old one first.

4. **Default color as a safety net:** set `ui.toast.defaultVariants.color = 'neutral'` in
   `app.config.ts` if the generated toast theme exposes it, so a stray direct `useToast().add`
   still isn't green. Verify the key against `.nuxt` types through `pnpm typecheck`, not by reading
   generated files by hand.

5. **Existing helpers stay and route through `useAppToast`:**
   - `useMutation`, `useDuplicateListingToast` (error, copy icon, View listing action),
     `useParsePrompt.toastError` and `useCopyAsText`.
   - The PWA update toast keeps its direct `add`, with its stable `id`, `duration: 0` and solid
     primary Reload. It is the one deliberate exception.

6. **Copy confirmations:** CoverLetterCard and the tailored CV copy currently toast success, and
   their buttons don't show `copied`. The button switches to a check icon and "Copied" through
   `useCopyAsText`'s existing `copied` ref, and the success toast is dropped.

7. **Disagreement with ui-ux-expert:** keep the save-first, partial-failure and "Groups suggested"
   messages as toasts with the correct kind for now. Moving them inline touches several screens
   and goes beyond "rework the toast". The warning color and 8 s fix the "unclear why nothing
   happened" problem well enough for this change.

8. **Clearing sticky bottom bars (decided by the owner during apply):** the after shots showed a
   bottom toast covering the skills bulk bar's Merge / Set category buttons on both phone and
   desktop.
   - The owner chose "lift above bars" over `top-center` and over accepting the overlap.
   - `useToastClearance(barRef)` measures the bar with `useElementSize`, but only while it is
     `position: sticky`, and publishes `--toast-clearance` on `<html>`. `app.vue` adds that to the
     toaster viewport's bottom offset through the toaster's `ui.viewport` class.
   - Pure CSS (`:has`) was rejected because the bars change height (a phone save bar wraps to two
     lines).
   - It is used by SaveBar, quick-add Actions, and the skills, companies and profile bars.

## Risks / Trade-offs

- **[Bottom toasts cover sticky bottom bars]** (SaveBar, profile save bar, skills and companies
  bulk bars, quick-add actions). After shots must include the profile save bar and the skills bulk
  bar at 375 and 1440.
  - A success toast over a just-used Save button for 4 s is acceptable.
  - If an error toast hides the button needed to retry, set the toaster's bottom offset above the
    bars (one commented `ui.toaster` class). If that fails, fall back to `top-center`, which clears
    the phone header buttons better than `top-right` did.
- **[8 s errors linger]** Hovering pauses and swiping or closing dismisses, so a long error can
  still be read or cleared.
- **[On-screen keyboard on iOS can hide bottom toasts]** Form errors that matter are already
  inline on most forms. Not verified on a device.
- **[Call-site churn, about 25 files]** It is mechanical. Tests assert titles and `actions[0]`
  only, so they change only where titles change on purpose.

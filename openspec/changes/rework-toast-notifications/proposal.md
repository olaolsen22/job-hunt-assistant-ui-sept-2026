# Proposal

## Why

Screenshots at 375/768/1440 show toasts that feel janky to the person using them. On phones they
cover the header and the page's main buttons. Toasts with no color render in the primary green, so
"Removed … from this CV" and "Save or discard your changes first." look like successes. Icons,
action buttons (tiny outline, solid green, solid red), durations and the progress bar vary from
call site to call site, because about 25 places each build their own toast.

## What Changes

- One standard look for each kind of toast (success, error, warning, info, undoable). Each kind
  always has a color and a matching icon, so no toast falls back to green by accident.
- Toasts move from top-right to bottom-right. On phones the toaster is already full width, so they
  appear at the bottom, clear of the header and page actions.
- The progress bar is off. At most 3 toasts show at once. Identical messages replace each other
  instead of stacking.
- Action buttons get one style and a touch-sized height. The update-available "Reload" stays the
  only solid primary action.
- Durations: success 4 s, info 5 s, and error, warning and undoable 8 s. Hovering still pauses the
  timer. The update-available toast still stays until it is dismissed.
- Copy rules: sentence case and no full stop on titles. A title names the item when it is known
  ("Archived Frontend Developer"). A description is added only when it gives a next step.
- Specific fixes:
  - "Unarchived" no longer offers Undo (that was an undo of an undo).
  - "Archived" names the listing.
  - "Save or discard your changes first" and "Save a version in another language first" become
    warnings.
  - Copy-as-text success toasts are dropped where the button already shows "Copied".
- One composable, which replaces `useSuccessToast`, owns the kinds. The existing error helpers
  (`useMutation`, `useDuplicateListingToast`, `useParsePrompt`'s `toastError`, `useCopyAsText`)
  go through it.

Out of scope:

- Moving blocking messages (save-first, the partial bulk failure, "Groups suggested") from toasts
  to inline alerts. ui-ux-expert recommended this. It is a separate per-screen change if the
  warning toasts still feel wrong.
- Dark-mode-specific styling.
- The text of API error messages.
- New packages.

Assumptions:

- No API message was pasted. Toasts use no API fields, so this is treated as a UI-only change.

## Capabilities

### New Capabilities

- `app-notifications`: how transient toast notifications look and behave across the app: kinds,
  position, durations, actions, stacking and copy.

### Modified Capabilities

None. Existing specs that mention a toast (company-management, listing-analysis, app-settings and
others) keep their wording. They only gain the standard look.

## Impact

- `app/app.vue` (toaster props) and `app/app.config.ts` (`ui.toast` defaults, if the theme
  supports them).
- A new composable replaces `app/composables/useSuccessToast.ts`. `SUCCESS_TOAST_DURATION` in
  `app/constants/ui.ts` becomes per-kind durations.
- About 25 call sites in `app/composables`, `app/components` and `app/pages`, plus
  `app/plugins/pwa-update.client.ts` (button overrides only).
- Tests that assert toast titles or actions: TailoredCvPage, CvTemplatePage, StatusTimeline and
  ListingSaveNavigation. Plus one new unit test for the composable.
- `docs/REUSABLES.md` and `.claude/state/ui-inventory.md` (helper rename).
- Risk: five sticky bottom bars (SaveBar, profile, skills and companies bulk bars, quick-add
  actions) can sit under a bottom toast. This is checked with screenshots during implementation;
  design.md has the fallback.

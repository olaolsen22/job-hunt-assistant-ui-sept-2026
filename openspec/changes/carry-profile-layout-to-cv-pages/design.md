# Design

## Context

- `ProfileSection` (`app/components/profile/Section.vue`) owns the three profile patterns: compact empty row, title
  count, and phone collapse (chevron header with `aria-expanded`, body hidden through `:ui`, injected
  `profile-mobile-collapsible` and `profile-jump-target`).
- Both CV pages render their content through `CvContentEditor` (`app/components/cv/ContentEditor.vue`), eight
  `ListingsTailoredCvSection` cards. That card has different header actions (Edit, Add menu, Tailor with AI) and a
  stacked body (warning badge, AI error, suggestions, empty block, slot), and sets `data-flagged`.
- "Next suggestion" and "Next flagged" on both pages find their targets with `querySelectorAll` and
  `getBoundingClientRect`, so a target inside a hidden body would be skipped.
- `cvTemplates/Editor.vue` already has the main + sticky rail grid, built with `contents` wrappers so the phone order
  differs from the desktop columns. `listings/[id]/cv.vue` is one `max-w-3xl` column wrapped in a
  `<fieldset :disabled="analyzing">`.
- Before screenshots (guest, empty data, light): `/tmp/claude-1000/cv-pages-shots/before-{375,768,1440}-*.png`.
  The guest account has no saved template, so `/cv-templates/[id]` needs mocked `/graphql` for its shots.

## Goals / Non-Goals

**Goals:** one section-card behaviour across profile, tailored CV and templates; nothing reviewable hidden on a
phone; the tailored CV uses desktop width like the template editor.

**Non-Goals:** changing `AppCard`; a shared layout component for the rail grid; any change to editor data flow,
AI runs, suggestions, save or PDF logic; changing the profile's behaviour.

## Decisions

### 1. Share the collapse through a composable and a header component

`app/composables/useCollapsibleCard.ts`: `useCollapsibleCard({ id, collapsible, defaultOpen, locked })` returns
`{ isCollapsible, isOpen, toggle }`. It owns the two injects (renamed `mobile-collapsible` and `jump-target`) and
the jump-target watcher. `locked` (a getter) makes `isCollapsible` false, so the card renders as a plain open card.

`app/components/app/CollapsibleHeader.vue` (`<AppCollapsibleHeader>`): the clickable header from `ProfileSection`
(role button, `aria-expanded`, Enter/Space, chevron, `title · count`) with an `actions` slot that is hidden while
collapsed and stops click propagation.

`ProfileSection` and `TailoredCvSection` are the two real uses. Alternatives (ui-controller's review): props on
`AppCard` were rejected because it has 35 usages and would carry inject logic into all of them; rendering
`ProfileSection` inside `TailoredCvSection` was rejected because the actions, empty state and body differ too much;
`UCollapsible` was rejected to keep the one header pattern the profile already ships and tests.

### 2. Lock a card open instead of badging a collapsed one

`TailoredCvSection` passes `locked: () => !!suggestions?.length || !!warning || !!error`. ui-ux-expert suggested
force-opening plus a badge on the collapsed header and making Next expand its target. Locking is simpler and
stricter: a card with something to review has no toggle, so no badge is needed and the existing DOM-based Next keeps
working unchanged. When the lock ends the card stays open (`isOpen` is set true while locked).

Entry-level flags (`experiences[0]`) and entry-level suggestions live inside the list cards. `ContentEditor` already
knows them (`warning(...)`, `ai.section(...)`), so it passes a `locked` prop to the section for those cases:
a section is locked when it or any of its entries has a suggestion, flag or error.

### 3. `ContentEditor` provides the phone flag

`ContentEditor` calls `useMediaQuery('(min-width: 768px)')` and provides `mobile-collapsible`, the same query the
profile uses. Both CV pages get it without page code. Defaults are passed per section: `default-open` true for
contact, summary and experience, false for the rest. `useMediaQuery` is false during SSR, as on the profile; the CV
content renders client-side after its query resolves, so there is no hydration difference to handle. Verify this
during apply and fall back to the profile's approach if a mismatch warning appears.

### 4. Compact empty row without a body button

The `emptyMessage` block becomes the profile's compact row markup (icon `size-5`, muted text), keeping the
`${testid}-empty` testid. ui-ux-expert suggested an in-body Add button as on the profile. Not adopted: here Add is a
dropdown of profile items and Contact/Summary/Languages use Edit, all already in the header one line above, and an
empty card is locked to neither state, so the header action is visible whenever the row is. Each section passes its
own icon rather than the generic inbox.

### 5. Counts

`ContentEditor` passes `:count` for the six list sections (`cv.experiences.length`, ...). Not for Contact or
Summary.

### 6. Tailored CV rail repeats the template editor's grid classes

`listings/[id]/cv.vue` gets the same grid as `cvTemplates/Editor.vue`:
`grid lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem] lg:items-start`, with `contents`
wrappers below `lg` and `order-first` / `order-last` to keep the phone order (AI card, banner, sections, PDF, save
bar). The page cap becomes `max-w-3xl lg:max-w-none`. The rail is `lg:sticky lg:top-4` with
`lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:p-px`, which answers the short-laptop risk. The style fields in
the rail stack in one column from `lg` (`md:grid-cols-2 lg:grid-cols-1`). The `<fieldset :disabled="analyzing">`
wraps the whole grid so both columns disable together; a fieldset can be the grid container's parent because the
page is also `inert` while analyzing. The refresh and generate error alerts stay in the main column above the save
bar. No shared layout component: two pages with different slot content, and the classes are one line
(ui-controller).

### 7. Template header on phones

In `cv-templates/[id].vue` the Versions button gets `hidden sm:inline-flex` and `moreItems` gains a Versions item
first, shown only below `sm` through `useMediaQuery('(min-width: 640px)')`, with the same `disabled` rule.

### 8. No "Jump to section" on the CV pages

ui-ux-expert suggested a phone-only jump menu. Not adopted: with five of eight cards collapsed the phone page is
about two screens, and the pages already have Next controls and a sticky save bar. The renamed `jump-target` inject
stays in the composable for the profile only.

## Risks / Trade-offs

- [Shared refactor regresses the profile] → `ProfileSection` and `ProfilePage` tests run unchanged apart from the
  provide keys; profile screenshots are retaken.
- [A locked card on a phone cannot be collapsed during a long review] → accepted; Accept all / Dismiss all and Next
  are one tap away, and hiding review items was the larger risk.
- [Sticky rail plus sticky save bar and toast clearance on desktop] → the save bar stays in the main column as on
  the template editor, which already works with `useToastClearance`; check at 1024 and 1440.
- [Layout at 1024 with the app sidebar open leaves a narrow main column] → same widths as the template editor, which
  was checked at 1024; recheck with the skills row controls, the widest content.

## Open Questions

- Icons per section for the empty row: pick during apply from the profile's section icons where the section matches.

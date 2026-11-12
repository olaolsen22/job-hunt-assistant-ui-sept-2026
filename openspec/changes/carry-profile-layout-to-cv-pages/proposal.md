# Proposal

## Why

The profile page now has compact empty rows, item counts and phone-only collapsible section cards, and its redesign
named the CV template and tailored CV pages as the next to follow. Those two pages still use the old tall cards: with
an empty profile the tailored CV page is about 2700 px tall on a phone and the template editor about 2850 px, against
about 1500 px for the profile. The tailored CV page is also a single narrow column on desktop, while the template
editor beside it already has a main column and a settings rail.

## What Changes

- **Editor section cards** (shared by both pages through `CvContentEditor`): an empty section is one compact row
  (icon and message) instead of a tall centered block. List sections show their item count after the title
  ("Experience · 3").
- **Phone-only collapsible sections** on both pages: Contact and headline, Summary and Experience start open, the rest
  start collapsed showing the count. A section with a pending AI suggestion, a "still in <language>" flag or an AI
  error is always open and cannot be collapsed, so nothing to review is ever hidden. No collapse from tablet width up.
- **Tailored CV on desktop**: from `lg` the page drops its narrow cap and becomes a main column (suggestions, content,
  save bar) with a sticky side rail holding the Tailor with AI / CV style card and the PDF card, the same shape as the
  template editor. Phone and tablet keep the current single-column order.
- **CV template header on phones**: Preview PDF stays a labelled button and Versions moves into the More menu, like
  the profile header's one action plus menu.
- **Shared code**: the collapse logic and header markup move out of `ProfileSection` into one composable and one
  header component, used by both `ProfileSection` and `TailoredCvSection`. The profile behaves as before.

Out of scope: a "Jump to section" nav on the CV pages (see design), changes to the tailored CV header and language
select, section order, any data, save, AI or PDF behaviour, the templates list page, and any API change.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `tailored-cv-drafts`: adds compact and counted editor sections, phone-only collapsible sections, and the desktop
  side rail.
- `cv-templates`: the template editor gets the same section cards and phone collapse, and Versions moves into the
  menu on phones.

`user-profile` requirements do not change; its section card is only refactored onto the shared code.

## Impact

- **Code**: `app/components/listings/TailoredCvSection.vue`, `app/components/cv/ContentEditor.vue`,
  `app/components/profile/Section.vue`, `app/pages/profile.vue` (provide keys only), `app/pages/listings/[id]/cv.vue`,
  `app/pages/cv-templates/[id].vue`; new `app/composables/useCollapsibleCard.ts` and
  `app/components/app/CollapsibleHeader.vue`.
- **Tests**: `ProfileSection`, `ProfilePage`, `TailoredCvPage`, `CvTemplatePage`, `CvTemplateNewPage`; a new
  `TailoredCvSection` test.
- **Docs**: `.claude/state/ui-inventory.md` and `docs/REUSABLES.md` for the two new shared exports.
- **No API changes, no new dependencies.** No API team message was pasted for this change; it is treated as
  layout-only.

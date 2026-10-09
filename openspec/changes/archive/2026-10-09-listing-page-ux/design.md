# Design

## Context

See proposal.md for the findings (owner review + `ui-ux-expert` pass). Current state that shapes the approach:

- `pages/listings/[id]/index.vue`: Back + four neutral subtle buttons in one `justify-between` row, then
  `ListingsApplication` (status + archived badges), then a "Job" `AppCard` holding the `h1`, favorite and analyzed
  badge. Labels `text-highlighted`, values `text-muted`.
- `pages/listings/[id]/edit.vue`: no Back, a lone "Paste from ad" button, confirm modal before save.
- `ParseModal.vue`: checkbox-dependent description in the `UModal` header; on built-in failure it sets
  `builtIn = false`. `useParsePrompt.parse` toasts and returns `undefined`.
- `ListingsCard` (list) already has the header pattern to copy: title, badges, muted icon rows, compact
  `ListingsDates`, "View posting" `soft neutral` button.
- `USelect` has no clear, so once picked, optional selects can't return to empty.
- `fill()` / `mergeDraft()` / `fillDraft()` already set `isAnalyzed`; no data work needed.

## Goals / Non-Goals

**Goals:** fix hierarchy, naming and field usability with Nuxt UI built-ins; keep existing `data-testid`s where the
element survives.

**Non-Goals:** a shared page-header component (toolbar contents differ between the two pages); new packages.

## Decisions

1. **Toolbar**: `flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`, Back `ghost neutral`
   `self-start`. Actions left-aligned at natural width on phones: "Analyze ad" `neutral subtle` `i-lucide-sparkles`,
   Edit solid primary, More = icon-only `neutral subtle` `i-lucide-ellipsis-vertical` with `aria-label="More actions"`
   opening `UDropdownMenu`; items computed from `analyzedAt` / `archivedAt`. Mark analyzed still opens the confirm.
   _Alternative_: soft primary for Analyze ad. Rejected: two green buttons read as two primaries, and the app uses
   neutral subtle for secondary actions.

2. **Header**: mirrors `ListingsCard` at a larger size: `h1 text-xl font-semibold text-highlighted break-words` +
   `ListingsFavoriteButton size="md"` (new optional `size` prop, default `xs`; two real uses). Badge row
   `ListingsStatusBadge prominent` (lg), `ListingsAnalyzedBadge size="lg"` (falls through to its `UBadge` root),
   archived `UBadge size="lg"` (moves from `Application.vue`, keeps `listing-archived`). Muted icon rows:
   `i-lucide-building-2` company, `i-lucide-briefcase` role, `ListingsLocation`. Compact `ListingsDates`. "View ad"
   `UButton variant="soft" color="neutral" icon="i-lucide-external-link"`. The list card's "View posting" label
   becomes "View ad".

3. **Dates**: the header uses compact `ListingsDates`, so its `detail` branch and prop are deleted; `Dates.test.ts`
   cases for `detail` go with it.

4. **Archived notice**: `UAlert color="neutral" variant="subtle" icon="i-lucide-archive"` with an "Unarchive" action
   calling `toggleArchived`.

5. **Details card**: `<dl class="grid gap-x-4 gap-y-3 sm:grid-cols-2">`, `dt text-xs text-muted`, `dd text-sm`
   (muted only for "Not stated"). Work mode, employment type, schedule, seniority, then language requirements and ad
   language. Large screens: `lg:grid-cols-3`, left `lg:col-span-2` holds Details then Summary, Skills on the right.
   Application card stays full width above.

6. **Skills / languages display**: two computed lists by `isRequired`, each with a `text-xs uppercase text-muted`
   label like Interviews' groups, omitted when empty; skill name `min-w-0 truncate`. Languages: `UBadge neutral
subtle` "English · C1 · required".

7. **Application card**: drop the status badge; Saved shows `text-sm text-muted` "Not applied yet" beside Apply.
   `applicationCount` is undocumented in the schema (unclear whether it includes this listing), so the text stays
   neutral: "Applications to {company}: N". `Interviews.vue` "Add interview" → `color="neutral"`.

8. **Edit page**: same toolbar (Back → `/listings/${id}`, Analyze ad opens the modal), then `h1` from
   `listing.title` (saved value, not `state`) and a muted company line. The save confirm modal stays (owner).

9. **Filled-from-ad notice**: `filledFromAd` ref set in `onDraft` on add and edit; dismissible
   `UAlert color="info" variant="subtle" icon="i-lucide-sparkles"` above the form, replacing the success toast. Edit
   adds "Fields the ad didn't mention kept their saved values. Saving marks it analyzed."

10. **Form order** (`Form.vue`, Details card): title (full), company, role, ad link (full); seniority, employment
    type; work mode, schedule; locations (full); language requirements (full), ad language; posted on, deadline.
    Rule kept and documented in REUSABLES: ≤3 options → `ListingsToggleGroup`, more → select.

11. **Clearable selects**: employment type, seniority, ad language and CEFR level switch from `USelect` to
    `USelectMenu :search-input="false" clear value-key="value"` with the same placeholder. Verify `clear` exists in
    the installed Nuxt UI (agent reports since 4.4; repo has ^4.11) before relying on it.

12. **Deadline**: one `UFormField label="Deadline" name="deadlineOn"` containing `flex gap-2`: `USelect` type
    (`w-36`, stays a select since a type is always required) and, when `DATE`, a date `UInput flex-1`. The separate
    "Deadline date" field goes. Check that `deadlineType` errors (if any) still surface; the validator only reports
    `deadlineOn` today.

13. **Skill / language rows**: each row `flex flex-col gap-2 sm:flex-row sm:items-center`; first part
    (name/language + New badge + remove on phones), second part the controls. Above the rows, a
    `hidden sm:flex text-xs text-muted` header ("Level · Min. years · Required"). Level items
    `{ label: 'Level N', value: N }` with `aria-label="Level"`; min years `UInputNumber :increment="false"
:decrement="false" aria-label="Minimum years" placeholder="Min. years"`. Remove buttons
    `aria-label="Remove {name}"` (skills, languages, locations). The skill search combobox moves below the rows.
    The remove button renders once per row and moves position with flex `order` classes between breakpoints, so
    there's no duplicated markup.

14. **Labels**: "Job ad URL" → "Ad link"; city placeholder "City (blank = whole country)"; CEFR placeholder
    "Any level"; Summary `UFormField label="Summary"` (card title dropped so it isn't said twice), placeholder
    shortened.

15. **Parse modal**: `UTabs :content="false"` bound to a `tab` ref, items computed (From link only with
    `listingId`), first item default. One shared `ad` ref for Paste ad and Use your own AI. Footer: Cancel
    `neutral ghost` + one primary per tab: "Parse from link" / "Parse ad" / "Use this reply". From link body:
    muted note "Reads the listing's saved link; unsaved form changes aren't used. Takes up to 25 seconds."
    Use your own AI: numbered steps 1 paste ad, 2 Copy prompt (`primary subtle`), 3 paste reply. While
    `parsing || parsingUrl`: `:dismissible="false"`, tabs and Cancel disabled. `UModal` title "Analyze ad", no
    changing description. _Alternative_: radio group. Rejected: tabs show all options and are built in.

16. **Parse errors**: `useParsePrompt.parse` returns `{ result } | { error }` like `parseFromUrl`; the modal shows
    the error in a `UAlert` in the Paste ad tab. Quick-add toasts the returned error and keeps its fallback.

## Risks / Trade-offs

- [Mark analyzed / Archive one click further away] → Infrequent; the menu sits next to Edit.
- [`USelectMenu` behaves a bit differently from `USelect` (typeahead off, popover)] → `:search-input="false"`
  keeps it select-like; a quick live check covers it.
- [Form reorder changes muscle memory on the add page too] → Same form on both pages, so it stays consistent.
- [`parse` return shape touches quick-add] → One call site; typecheck catches a miss.
- [Edit solid primary and Apply solid primary on one screen] → Different areas (toolbar vs Application card);
  accepted.
- [Static checks don't prove layout] → Owner live check at mobile and desktop width.

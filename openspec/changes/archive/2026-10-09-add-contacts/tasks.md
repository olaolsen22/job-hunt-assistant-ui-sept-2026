## 1. Setup

- [x] 1.1 `pnpm gql:gen` to pick up the contacts schema; commit `app/graphql-env.d.ts`
- [x] 1.2 Ask `ui-ux-expert` for the Contacts card layout on the company and listing pages (fits next to Locations / Details, phone + desktop)

## 2. Display

- [x] 2.1 Add a `CONTACT_FIELDS` fragment and fetch `contacts` in the company page query and `useListing`
- [x] 2.2 Add `CompaniesContactList` (name, title, mailto/tel/external links, Markdown notes, optional edit/delete actions)
- [x] 2.3 Company page: Contacts card with the list, centered empty state, Add button
- [x] 2.4 Listing page: read-only Contacts card, hidden when empty, link to the company page

## 3. Manage contacts

- [x] 3.1 Add `CompaniesContactModal` (add/edit, name required, blanks → null) calling `addContact` / `updateContact`, showing returned errors
- [x] 3.2 Delete via `AppConfirmModal` with `deleteContact` (message: linked listings are kept); refresh the company after each change

## 4. Parsed contacts on save

- [x] 4.1 `useListingForm`: `contacts` state (null by default and after `fill`), clean draft contacts in `cleanDraft`, set in `fillDraft` / `mergeDraft` (only when present), send in `toInput` only when non-null
- [x] 4.2 Check add, edit, and analyze-existing flows still send/omit contacts correctly

- [x] 4.3 Listing form Contacts card (`ListingsContactsField`): load linked contacts on edit, add/remove rows, always send; merge parsed contacts by name

## 5. Tests and wrap-up

- [x] 5.1 Unit: company page shows a contact and adds one (registerEndpoint); `toInput` omits contacts after `fill` and includes cleaned contacts after `fillDraft`
- [x] 5.2 Update `docs/REUSABLES.md` and `.claude/state/ui-inventory.md` for the new components
- [x] 5.3 `pnpm typecheck`, `pnpm lint`, `pnpm test`, then `pnpm build` and `pnpm preview --port 3000`
- [x] 5.4 `/log-progress`

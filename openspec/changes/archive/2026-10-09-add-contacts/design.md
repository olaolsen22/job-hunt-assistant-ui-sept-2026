# Design

## Context

Contacts belong to a company (`Company.contacts`) and are linked to listings
(`Listing.contacts { contact }`). CRUD is `addContact` / `updateContact` (full replace) /
`deleteContact` (unlinks only). `ListingInput.contacts` is optional: omitted keeps links, a list
matches by name in the company or creates, and empty fields of existing contacts get filled.

## Decisions

- **One `CONTACT_FIELDS` fragment** (`id name title email phone url notes`) used by the company page
  and `useListing`, so both cards render the same shape. Typed with `ResultOf`.
- **Shared display component** `CompaniesContactList` (name, title, mailto/tel/external links,
  notes via `LazyAppMarkdownContent`), used on both pages = 2 real uses. Edit/delete actions only
  rendered when the company page passes handlers.
- **`CompaniesContactModal`** for add/edit, modeled on the profile `ReferenceModal` (UForm, name
  required, `orNull` for blanks). Delete via `AppConfirmModal`. Mutations through `useMutation`;
  on success `refresh()` the company query (no cache juggling).
- **Form state `contacts: ListingContact[]`**, filled from `listing.contacts` by `fill()`, edited in
  `ListingsContactsField` (rows like `LocationsField`). `toInput` always sends it, minus blank names,
  so the form owns the links. `fillDraft` replaces it; `mergeDraft` appends new names only. Notes
  aren't edited here (company page), and existing contacts only get empty fields filled by the API.
- **Prompt version 7**: the prompt text comes from the server, so no UI change beyond reading contacts.
- Changing company: the API clears links, then the sent rows are matched/created in the new company.

## Risks

- A parsed contact matching an existing one by name only fills empty fields; the UI can't show
  what got merged. Acceptable: the listing page shows the result after save.

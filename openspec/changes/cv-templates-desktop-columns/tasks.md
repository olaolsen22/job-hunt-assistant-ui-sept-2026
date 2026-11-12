# Tasks

## 1. Prerequisite

- [ ] 1.1 Confirm `rework-cv-template-flow` is archived (or archive it) so the `cv-templates` delta applies; take
      before screenshots of `/cv-templates`, `/cv-templates/new?name=…` and an editor at 375/768/1024/1440, light,
      guest or mocked data, into the scratchpad

## 2. List

- [x] 2.1 `pages/cv-templates/index.vue`: card grid `xl:grid-cols-2 2xl:grid-cols-3`, equal-height cards with
      actions at the bottom, skeleton/empty `col-span-full`; keep existing testids

## 3. Create and editor

- [x] 3.1 `cvTemplates/Editor.vue`: main + sticky rail grid with a `#rail` slot; the Layout card in the rail, fields
      stacked from `lg` (replaces the planned LayoutCard extraction, see design 3)
- [x] 3.2 `pages/cv-templates/[id].vue`: drop the `max-w-3xl` cap from `lg`
- [x] 3.3 `pages/cv-templates/new.vue`: drop the cap from `lg`; Details card into the `#rail` slot (first on phone)
- [x] 3.4 Inventory: no reusable export changed (Editor is not listed), so no update

## 4. Checks

- [x] 4.1 `pnpm vitest run` CvTemplatesList, CvTemplatePage and CvTemplateNewPage; then `pnpm lint` and
      `pnpm typecheck`
- [x] 4.2 Rebuild preview, then take the same screenshots after; check that the sticky rail scrolls at 1024 and
      1440, and that phone and tablet are unchanged
- [x] 4.3 Run ui-reviewer on the diff and the before/after screenshots; fix confirmed issues

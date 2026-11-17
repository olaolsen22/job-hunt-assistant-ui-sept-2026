---
name: nuxt-ui
description: Nuxt UI v4 API facts and this project's theme defaults. Use when writing or reviewing any template that uses U* components (UButton, UFormField, UModal, USelectMenu, UDropdownMenu, UTabs, ...), or when unsure of a prop, slot or event name.
---

This project runs **Nuxt UI v4** (`@nuxt/ui` ^4.11) on Reka UI and Tailwind 4. Most model knowledge
and old examples are v2 — those APIs are wrong here. Check this file first, then
`reference.md` (props/slots/events of every component the app uses), then the official raw docs
`https://ui.nuxt.com/raw/docs/components/<kebab-name>.md` (no need to read `node_modules`).

## v2 habits that break in v4

| Wrong (v2 / guessed)                              | Right (v4)                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `UFormGroup`                                      | `UFormField` (`label`, `description`, `hint`, `help`, `error`, `required`)                 |
| `UButtonGroup`                                    | `UFieldGroup`                                                                              |
| `UDropdown`                                       | `UDropdownMenu`                                                                            |
| `UToggle`                                         | `USwitch`                                                                                  |
| `UDivider`                                        | `USeparator`                                                                               |
| `UNotification`, `useToast().add({ ... })`        | here: `useAppToast()` (wraps toasts; never raw `useToast()`)                               |
| `color="gray"`                                    | `color="neutral"` (colors: primary, secondary, success, info, warning, error, neutral)     |
| `options=`, `option-attribute`, `value-attribute` | `items=`, `label-key`, `value-key`                                                         |
| menu item `click: () => {}`                       | `onSelect: (e) => {}`; groups are nested arrays `[[a, b], [c]]`                            |
| `<UModal v-model="open">` + default slot card     | `v-model:open`, `title`/`description` props, `#body` / `#footer` slots                     |
| `v-model.nullify`                                 | `v-model.nullable` (empty → `null`) or `.optional` (empty → `undefined`)                   |
| `UForm` nested via `:state="item"`                | nested forms need `nested` + `name="items.0"`; schema transforms only reach `@submit` data |
| Tabs content via default slot                     | `items` with `slot: 'name' as const` → `<template #name>`; `label`, `value`, `icon`        |

Overlays: `UModal` / `USlideover` slots are `content` (replaces everything), `header`, `title`,
`description`, `actions`, `close`, `body`, `footer`. `dismissible: false` blocks outside-click/Escape
(listen to `close:prevent`). `useOverlay()` exists for programmatic modals.

Variants: `UButton` solid|outline|soft|subtle|ghost|link; `UBadge`/`UAlert`/`UCard`
solid|outline|soft|subtle; inputs outline|soft|subtle|ghost|none. Buttons with `to` render as links
(no wrapping `ULink`). `loading-auto` shows a spinner while an async `@click` runs.

`UEmpty` exists in v4, but this app's empty state is its own pattern (below) — keep it consistent
unless the owner decides to switch.

## Project defaults (`app/app.config.ts`)

- Theme: `primary: 'green'`, `neutral: 'slate'`. Use semantic classes/tokens (`text-muted`,
  `text-dimmed`, `bg-elevated`, `border-default`, `text-primary`, `--ui-*`), never raw palette colors
  like `text-gray-500` / `bg-green-600`.
- Inputs, selects, textareas, input menus, buttons and switches default to `size: 'lg'`
  (touch-sized; `max-sm:text-base` stops iOS zoom). Don't add `size="lg"`; only set `size` to go smaller
  on purpose (e.g. dense table rows).
- Toast default color is `neutral`; always go through `useAppToast()` (`success|info|warning|error|undoable`).
- Icons: `i-lucide-*` only.
- Customise in this order: component props/slots → Tailwind built-in classes on `class` → `:ui` slot
  overrides → custom CSS. Anything past `class` needs a stated reason in a comment.

## Project wrappers to use before raw components

Check `docs/REUSABLES.md` (search by name) for props. The common ones:

- `AppCard` (titled section card), `AppFormModal` (modal with form + save/cancel),
  `AppConfirmModal` (destructive confirm), `AppSaveBar`, `AppCompareBlock`.
- AI flows: `AppAiModal` and the `AppAi*` family with `useAiRequest()` — don't hand-roll AI modals.
- Filters: `AppFilterChips`, `AppFilterSheet`, `AppFilterCombobox`. Markdown: `AppMarkdown*`.

Empty state pattern (centered muted icon above text, optional action):

```vue
<div class="flex flex-col items-center gap-3 py-6 text-center">
  <UIcon name="i-lucide-briefcase" class="size-10 text-muted" />
  <p class="text-sm text-muted">No applications yet.</p>
  <UButton color="neutral" variant="subtle" icon="i-lucide-plus">Add one</UButton>
</div>
```

Loading: `USkeleton` shaped like the final content. Errors: `<UAlert color="error" :description="..." />` —
load failures use `ERROR_MESSAGES` from `~/constants/errorMessages`; mutation errors show the API's
own message (via `useMutation`).

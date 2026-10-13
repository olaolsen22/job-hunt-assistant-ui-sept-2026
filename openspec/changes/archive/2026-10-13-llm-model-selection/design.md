# Design

## Context

Six built-in AI mutations run from three composables: `useParsePrompt` (parseListing, parseListingFromUrl,
parseUrl; used by `ParseModal`, `pages/listings/quick-add.vue`, `pages/companies/add.vue`), `useProfileCvImport`
(parseProfileCv; `CvImportModal`) and `useTailoredCvDraft` (analyzeTailoredCvSection per step, driven by
`pages/listings/[id]/cv.vue` after `TailoredCvAiModal`). `analyzeAllTailoredCv` is not used: the editor runs one
section request at a time. Usage comes from `useLlmUsage` (shared `useAsyncData` key `dashboard-llm-usage`) and is
shown by `DashboardLlmUsage` and `AppAiCostNotice`. There is no settings page; the profile page has read-first
`ProfileSection` cards with `AppFormModal` editors. `app/graphql-env.d.ts` was regenerated with `pnpm gql:gen` for this
change. Quick add's collected-job batches also call `parse` (`useCollectedJobProcessing(parse)`).

## Goals / Non-Goals

**Goals:** one shared models source, one picker component, the model passed as an explicit argument.

**Non-Goals:** Pinia state, persisting a per-action pick, `ParseJob.model`, role checks.

## Decisions

- **`useLlmModels()` composable, not Pinia.** `useAsyncData('llm-models', …, { server: false })` follows
  `useLlmUsage`; the shared key means one request for every picker on the page. It exposes `models`, `defaultModel`,
  `refresh`, a `label(id)` that falls back to the id, and `setDefault(model | null)`. `setDefault` runs through
  `useMutation().run` (toasts typed errors). On success it writes the returned `llmModels` into `data.value` and calls
  `refreshNuxtData('dashboard-llm-usage')`, since the usage data may not be mounted. On `UnknownLlmModelError` it
  refreshes. Alternative: a store. Rejected because the only store is auth, and this is cached server data.
- **`AppLlmModelSelect` (`v-model: string | undefined`).** A `USelect` labelled "Model" that renders only when there
  are more than one model, stays hidden while loading (a select that vanishes for one-model accounts would flicker) and on fetch failure. Hosts keep a local `model`
  ref and reset it to `defaultModel` when they open (or mount, on pages) and when `defaultModel` changes, so a
  pick made before models load, or after a refresh, lands on the current default. Not placed inside `AiCostNotice`, because
  quick add and add companies don't render it. ui-ux-expert placed it directly above or next to each run button.
- **Explicit `model?` argument.** `parse(posting, model?)`, `parseFromUrl(id, model?)`, `parseNewUrl(url, model?)`,
  `parse(text, model?)` in CV import, and `analyzeAll(model?)` / `analyzeSection(key, model?)` → `runStep`. The parse
  documents get `$model: String` in their input. `AnalyzeTailoredCvSection` already takes the whole `$input` object,
  so only its variables change. Callers pass `model === defaultModel ? undefined : model`, so the
  server's own default stays authoritative. Alternative: a global `selected` ref read inside the composables
  (suggested by ui-controller). Rejected because the pick must reset per open and it would hide data flow.
- **Unknown model.** A small exported `isUnknownModel(errors)` in `useLlmModels.ts` checks `__typename`. Each
  composable keeps showing the message where it does now (inline in modals, toast on pages). Callers then call
  `refresh()` and reset their pick. Quick add passes `(posting) => parse(posting, pick())` to
  `useCollectedJobProcessing`, reading the pick per batch, so an unknown model pauses the run as any failure does and
  Retry uses the reset default. `analyzeAll` stops after a step returns `UnknownLlmModelError`, since every
  remaining section would fail the same way. `useParsePrompt`'s three copies of the result handling are folded into one local
  helper while adding this.
- **Usage notice.** `AiCostNotice` gets an optional `model` prop (the pick). It shows `{label} · n of m requests`,
  and adds a line when the pick differs from `usage.model`. The widget shows the label (via `useLlmModels().label`, so the
  dashboard makes one extra models request) as a neutral subtle `UBadge` by the count, and its "Counts all users of the API" line goes.
- **Default setting.** A `ProfileLlmModelCard` in the profile page's right column (a `ProfileSection` with Edit), plus
  `ProfileLlmModelModal` (`AppFormModal` with the select and a "Use app default" button that sends `null`). The
  ui-ux-expert asked whether to offer the null option. It's kept as a button rather than a select item, because the
  API doesn't say which model the app default is.

## Risks / Trade-offs

- [Usage counts only the default model] → The notice says so when the pick differs. Per-model usage isn't in the
  contract.
- [One more request on AI modals and the profile page] → Shared key and `server: false`, one cheap query.
- [Test files register one `/graphql` endpoint each] → Each affected test handler gains an `llmModels` branch.

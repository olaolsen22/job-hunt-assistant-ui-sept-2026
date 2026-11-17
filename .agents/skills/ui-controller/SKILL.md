---
name: ui-controller
description: Read-only advice for a difficult UI reuse question. Find existing components, composables, and API helpers to reuse or extend; no implementation or routine preflight.
---

Apply this workflow inline; do not spawn a subagent unless the owner asks. You inspect; you never edit files.

Use the supplied scope, paths, and known findings. Do not repeat startup, read the whole work log,
or scan unrelated features. Batch independent lookups and stop when the reuse question is answered.
Recommend idiomatic Nuxt reuse proportional to this personal portfolio project. Do not run checks;
if evidence is insufficient, name the specific unknown rather than inventing a conclusion.

Given a UI task:

1. Search likely `app/` feature paths for existing components and helpers. Read only the line ranges you need.
2. For data needs, search `../job-hunt-assistant-api-sept-2026/schema.graphql` for the relevant
   queries, mutations, types, and errors. Never invent fields. If something isn't there directly, say how
   to get it client-side only when the contract supports that approach; otherwise state the limitation.
3. Check how similar features already do it (data fetching, mutations via `useMutation`, forms, modals,
   loading/error states).

Reply in at most ~12 lines:

- A few concrete paths (`file:line` where useful) with what each provides.
- Recommendation: reuse as-is, extend (what to add), or create new (only if nothing fits, and why).
- Any inventory entry that is stale or missing, so the main agent can update it.

No plans, no code beyond a short signature or snippet.

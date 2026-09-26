---
name: log-progress
description: Update docs/STATUS.md so it reflects what the UI currently contains. Use after finishing a milestone or a notable feature, or when the user asks to log progress.
---

Update `docs/STATUS.md` cheaply and accurately:

1. Read `docs/STATUS.md` and note the `Last logged commit` hash. If the file doesn't exist, create it
   with these sections: header (`Updated`, `Last logged commit`), Pages, Components, Stores & composables,
   API operations in use, Milestones, Next up, Decisions log.
2. Run `git log --oneline <hash>..HEAD` and `git diff --stat <hash>` (include uncommitted changes). If there's
   no hash yet, use `git log --oneline` and `git status --short`.
3. Read only the changed files that matter. Use Glob on `app/pages/**`, `app/components/**`, `app/stores/**`,
   `app/composables/**`, `app/middleware/**`, and Grep for `defineStore`, `useFetch`, `$fetch`,
   `query `, `mutation `, `subscription ` rather than reading whole files.
4. Edit STATUS.md in place: update routes, components by feature folder, stores, the REST endpoints and
   GraphQL operations the UI uses, milestone statuses, and "Next up". Add at most a one-line entry to the
   Decisions log for each real decision made.
5. Set `Last logged commit` to the current `HEAD` short hash and `Updated` to today's date.

Rules: replace stale content rather than appending history. Keep the file under ~150 lines, with facts
only and no prose. Don't commit.

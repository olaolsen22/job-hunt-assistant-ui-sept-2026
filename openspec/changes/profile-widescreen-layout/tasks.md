# Tasks

## 1. Widen the profile page at 2xl

- [x] 1.1 Add `2xl:max-w-[1400px]` to the outer content wrapper in `app/pages/profile.vue` (line 311, the `<div class="w-full min-w-0 max-w-3xl …">`) — verify `pnpm typecheck` and `pnpm lint` pass
- [x] 1.2 Add the same `2xl:max-w-[1400px]` to the loading skeleton wrapper (line 316, the `<div class="space-y-4">` parent's sibling) — verify the skeleton div's classes match the loaded content div's width classes
- [x] 1.3 Build the preview (`echo '{}' | .claude/hooks/preview.sh`) and verify it succeeds without errors
- [x] 1.4 Screenshot the profile page at 2560px width and confirm the content is wider than the previous 1152px cap, with the 3-column grid and cover letter zone filling more of the viewport

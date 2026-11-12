# Tasks

## 1. Switch the profile grid to 4 columns at 2xl

- [x] 1.1 In `app/pages/profile.vue`, add `2xl:grid-cols-4` to the main grid div (`grid grid-cols-1 items-start gap-4 lg:grid-cols-3`) and add `2xl:col-span-3` to the main column div (`space-y-4 lg:col-span-2`) — verify `pnpm typecheck` and `pnpm lint` pass
- [x] 1.2 Add `2xl:grid-cols-4` to the loading skeleton grid div (`grid gap-4 lg:grid-cols-3`) and `2xl:col-span-3` to the main skeleton (`h-64 w-full lg:col-span-2`) — verify the skeleton classes match the loaded content grid's responsive pattern
- [x] 1.3 Build the preview (`echo '{}' | .claude/hooks/preview.sh`) and verify it succeeds without errors
- [x] 1.4 Screenshot the profile page at 2560px width and confirm the grid uses a 3/4 + 1/4 column split, with the main column visibly wider than before

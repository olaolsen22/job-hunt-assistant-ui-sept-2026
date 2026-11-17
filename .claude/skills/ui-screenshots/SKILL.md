---
name: ui-screenshots
description: Screenshot app screens (guest login, optional mocked GraphQL data) at phone, tablet and desktop widths, light and dark. Use after any UI change before calling it done, or to look at a current screen before advising on it. Pre-authorized; not the E2E suite.
---

The owner wants every UI change seen, not inferred from code — static checks miss layout,
truncation and overflow. Using the guest account and mock data for this is pre-authorized.

## Steps

1. The preview must be current: after code changes run the `rebuild-preview` skill first (port 3000).
2. If the screen needs data the guest doesn't have, write a mocks module **outside the repo**
   (e.g. `/tmp/ui-mocks/<name>.mjs`):

   ```js
   export default async (page) => {
     await page.route('**/graphql', async (route) => {
       const { query } = route.request().postDataJSON()
       if (!/\blistings\s*\(/.test(query)) return route.continue() // only mock what you need
       return route.fulfill({ json: { data: { listings: { items: [], totalCount: 0 } } } })
     })
   }
   ```

   Shape the data from the screen's `graphql()` document (and `test/e2e/*.spec.ts` for examples);
   never invent fields. Mocks are added after the real guest login, so login is never mocked.

3. Shoot from the repo root:

   ```bash
   node .claude/skills/ui-screenshots/shoot.mjs /listings /companies/1 \
     --mocks /tmp/ui-mocks/listings.mjs --dark
   ```

   Defaults: widths `375,1280` (add `--sizes 375,768,1280` for layout work), scale 1, viewport-only, output `/tmp/ui-shots/<route>-<width>[-dark].png`.
   Options: `--sizes 360,1024` · `--full` (whole page) · `--scale 2` (images the owner will see) ·
   `--out <dir>` · `--base <url>`. It prints each file, flags horizontal overflow, and echoes
   console/page errors (one 401 from `/api/auth/me` on the login page is normal).

4. Read each PNG once (images are token-heavy: shoot only the changed routes, dark only when colors
   changed). Check: hierarchy and the obvious next action, wrapping and
   truncation of long text, touch target size on 375, tablet fit with the sidebar, dark-mode contrast,
   empty/loading/error states if relevant (mock them). For interactions (open a modal, fill a form)
   copy `shoot.mjs` to `/tmp` and add the steps — keep the original unchanged.

5. Report what you saw, with the file paths. Send the owner the important images
   (`--scale 2`). Delete temporary mocks/scripts you no longer need.

Don't run `pnpm test:e2e` or Playwright test files for this.

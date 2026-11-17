# Project instructions

- Create tests for new features and update relevant tests when changing existing features.
- When creating or updating tests, run only the tests for the component you created or edited.
- Do not run any other tests or broader test suites unless the user explicitly instructs you to do so.
- After finishing every modification, stop any existing `pnpm preview` processes for this project, run `pnpm build`, then start `pnpm preview` as a persistent background process. Ensure the preview remains running after the task ends.

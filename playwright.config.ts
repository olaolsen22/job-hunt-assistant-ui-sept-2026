import { defineConfig, devices } from '@playwright/test'

const port = 3100

export default defineConfig({
  testDir: 'test/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
    // The app's service worker would answer requests before page.route mocks could see them.
    serviceWorkers: 'block'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Runs the production build; the API is mocked per test, so no backend is needed.
  webServer: {
    command: `pnpm build && PORT=${port} node .output/server/index.mjs`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000
  }
})

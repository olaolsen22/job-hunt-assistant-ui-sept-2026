import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

const standaloneTests = ['test/unit/formatMonth.test.ts', 'test/unit/useListingForm.test.ts']

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: { '~': fileURLToPath(new URL('./app', import.meta.url)) } },
        test: { name: 'unit', environment: 'node', include: standaloneTests }
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          environment: 'nuxt',
          include: ['test/unit/**/*.test.ts'],
          exclude: standaloneTests
        }
      })
    ]
  }
})

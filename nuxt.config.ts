// Baked in at build time: routeRules proxies are resolved when Nitro builds.
const apiUrl = process.env.API_URL ?? 'http://localhost:5044'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-26',
  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@pinia/nuxt', '@nuxt/eslint', '@nuxt/test-utils/module'],

  // Tailwind/Nuxt UI first, then custom SCSS so it can override.
  css: ['~/assets/css/main.css', '~/assets/scss/main.scss'],

  colorMode: {
    preference: 'system',
    fallback: 'light'
  },

  // Same-origin proxy: the HttpOnly session cookie and SSE work without CORS.
  routeRules: {
    '/api/**': { proxy: `${apiUrl}/api/**` },
    '/graphql': { proxy: `${apiUrl}/graphql` }
  }
})

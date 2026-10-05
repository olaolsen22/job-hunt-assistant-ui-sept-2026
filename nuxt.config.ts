// Baked in at build time: routeRules proxies are resolved when Nitro builds.
const apiUrl = process.env.API_URL ?? 'http://localhost:5044'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-26',
  // SPA: every page is behind login, so SSR buys little. Keeping all API calls in the browser
  // also lets e2e mock them with page.route. Nitro still runs for the proxy.
  ssr: false,

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]
    }
  },
  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@pinia/nuxt', '@nuxt/eslint', '@nuxt/test-utils/module'],

  // Tailwind/Nuxt UI first, then custom SCSS so it can override.
  css: ['~/assets/css/main.css', '~/assets/scss/main.scss'],

  colorMode: {
    preference: 'system',
    fallback: 'light'
  },

  // gql.tada infers GraphQL result/variable types from the API schema. Paths are relative to
  // .nuxt/tsconfig.app.json, where Nuxt writes this.
  typescript: {
    tsConfig: {
      compilerOptions: {
        plugins: [
          {
            name: 'gql.tada/ts-plugin',
            schema: '../../job-hunt-assistant-api-sept-2026/schema.graphql',
            tadaOutputLocation: '../app/graphql-env.d.ts'
          }
        ]
      }
    }
  },

  // Vite's dev server rejects unknown Host headers; `tailscale serve` forwards the *.ts.net name.
  // clientPort: the phone reaches the dev server through serve's HTTPS on 443, not :3000.
  vite: { server: { allowedHosts: ['.ts.net'], hmr: { clientPort: 443 } } },

  // Same-origin proxy: the HttpOnly session cookie and SSE work without CORS.
  routeRules: {
    '/api/**': { proxy: `${apiUrl}/api/**` },
    '/graphql': { proxy: `${apiUrl}/graphql` }
  }
})

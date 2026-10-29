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
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        // iOS ignores manifest icons and SVGs for the home screen.
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }
      ],
      // Installable to the home screen, opening without browser chrome. No viewport-fit=cover, so
      // iOS keeps content clear of the notch and home indicator without safe-area insets.
      meta: [
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'Job Hunt' }
      ]
    }
  },
  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@pinia/nuxt', '@nuxt/eslint', '@nuxt/test-utils/module', '@vite-pwa/nuxt'],

  // Own service worker (app/sw.ts): precached shell, update prompt, and background reminders.
  // 'prompt', not auto-update: a silent reload would throw away a half-filled form.
  pwa: {
    strategies: 'injectManifest',
    // Relative to Vite's root, which Nuxt sets to app/.
    srcDir: '.',
    filename: 'sw.ts',
    registerType: 'prompt',
    // Off in unit tests, where $pwa is then undefined.
    disable: !!process.env.VITEST,
    injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    manifest: {
      id: '/',
      name: 'Job Hunt Assistant',
      short_name: 'Job Hunt',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: '#ffffff',
      background_color: '#ffffff',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    }
  },

  // Other icons load from the server on first use, which fails offline; error.vue's offline
  // screen needs its icons in the bundle.
  icon: { clientBundle: { icons: ['lucide:wifi-off', 'lucide:rotate-cw'] } },

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

  // The SPA shell as a real index.html, so the service worker can precache it for offline starts.
  nitro: { prerender: { routes: ['/'] } },

  // Same-origin proxy: the HttpOnly session cookie and SSE work without CORS.
  routeRules: {
    '/api/**': { proxy: `${apiUrl}/api/**` },
    '/graphql': { proxy: `${apiUrl}/graphql` }
  }
})

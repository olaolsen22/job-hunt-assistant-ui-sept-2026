// Screenshots app routes as the guest user at phone, tablet and desktop widths.
// Usage: node .claude/skills/ui-screenshots/shoot.mjs <route> [<route> ...]
//   --mocks <file.mjs>  module whose default export `async (page) => {}` adds page.route mocks
//   --sizes 375,1280      viewport widths     --dark  also shoot dark mode
//   --scale 2  device scale (2 for images the owner sees)   --out /tmp/ui-shots
//   --base http://localhost:3000   --full  full-page screenshot
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? fallback : args.splice(i, 2)[1]
}
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i !== -1 && args.splice(i, 1).length > 0
}

const base = opt('base', 'http://localhost:3000')
const out = opt('out', '/tmp/ui-shots')
const mocks = opt('mocks')
const scale = Number(opt('scale', '1'))
const sizes = opt('sizes', '375,1280').split(',').map(Number)
const dark = flag('dark')
const full = flag('full')
const routes = args
if (!routes.length) {
  console.error('Give at least one route, e.g. /listings')
  process.exit(1)
}

const heights = { 360: 740, 375: 812, 390: 844, 768: 1024, 1024: 768, 1280: 800, 1440: 900 }
const setup = mocks ? (await import(pathToFileURL(resolve(mocks)).href)).default : null
mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
try {
  for (const scheme of dark ? ['light', 'dark'] : ['light']) {
    const context = await browser.newContext({ colorScheme: scheme, deviceScaleFactor: scale })
    const page = await context.newPage()
    page.on('console', (m) => m.type() === 'error' && console.log(`  console error: ${m.text()}`))
    page.on('pageerror', (e) => console.log(`  page error: ${e.message}`))

    // Real guest session first, then the mocks, so login itself is never mocked.
    await page.goto(`${base}/login`)
    await page.getByRole('button', { name: 'Continue as guest' }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'))
    if (setup) await setup(page)

    for (const route of routes) {
      for (const width of sizes) {
        await page.setViewportSize({ width, height: heights[width] ?? 900 })
        await page.goto(`${base}${route}`)
        await page.waitForLoadState('networkidle')
        const slug = route.replace(/^\/|\/$/g, '').replace(/[^\w-]+/g, '_') || 'home'
        const file = `${out}/${slug}-${width}${scheme === 'dark' ? '-dark' : ''}.png`
        await page.screenshot({ path: file, fullPage: full })
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth
        )
        console.log(`${file}${overflow ? '  ⚠ horizontal overflow' : ''}`)
      }
    }
    await context.close()
  }
} finally {
  await browser.close()
}

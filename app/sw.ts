/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { print } from '@0no-co/graphql.web'
import { REMINDERS, newReminders, pickReminders } from './utils/reminders'
import type { ResultOf } from 'gql.tada'

declare let self: ServiceWorkerGlobalScope

// Built app files only. Nothing else is cached, so /api and /graphql always hit the network and
// can't show stale or another session's data.
cleanupOutdatedCaches()
const manifest = self.__WB_MANIFEST
precacheAndRoute(manifest)
// Any page opens from the cached SPA shell, so a cold start offline reaches the offline screen.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/'), { denylist: [/^\/api\//, /^\/graphql/] })
)

type ReminderState = { notified: string[]; lastCheck: string | null }

// A worker has no localStorage; one JSON entry in the Cache API is enough.
const STATE_URL = '/__reminders-state'
const readState = async (): Promise<ReminderState> => {
  const res = await (await caches.open('reminders')).match(STATE_URL)
  return res ? res.json() : { notified: [], lastCheck: null }
}
const writeState = async (state: ReminderState) =>
  (await caches.open('reminders')).put(STATE_URL, new Response(JSON.stringify(state)))

// gql() needs Nuxt's $fetch, which doesn't exist here; same request, plain fetch.
const fetchReminders = async () => {
  const res = await fetch('/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: print(REMINDERS), variables: { now: new Date().toISOString() } })
  })
  const json = (await res.json()) as { data?: ResultOf<typeof REMINDERS>; errors?: unknown[] }
  if (!res.ok || json.errors?.length || !json.data) throw new Error('Reminder check failed')
  return json.data
}

// Returns how many notifications it showed. Throws when offline or signed out.
const checkReminders = async () => {
  const reminders = pickReminders(await fetchReminders())
  const state = await readState()
  const fresh = newReminders(reminders, state.notified)
  await Promise.all(
    fresh.map((r) =>
      self.registration.showNotification(r.title, {
        body: r.body,
        tag: r.key,
        icon: '/icon-192.png',
        data: { url: r.url }
      })
    )
  )
  const lastCheck = new Date().toISOString()
  // Only keys still due are kept, so the list never grows past the current reminders.
  await writeState({ notified: reminders.map((r) => r.key), lastCheck })
  return { sent: fresh.length, lastCheck }
}

type PeriodicSyncEvent = ExtendableEvent & { tag: string }

self.addEventListener('periodicsync', (event) => {
  const sync = event as PeriodicSyncEvent
  if (sync.tag === 'reminders') sync.waitUntil(checkReminders().catch(() => undefined))
})

self.addEventListener('message', (event) => {
  const type = event.data?.type
  // The sidebar's Refresh app action activates a downloaded update.
  if (type === 'SKIP_WAITING') self.skipWaiting()
  // Settings' Check now and last-check line, answered over the MessageChannel port it sent.
  const port = event.ports[0]
  if (type === 'CHECK_REMINDERS' && port) {
    event.waitUntil(
      checkReminders().then(
        (result) => port.postMessage(result),
        () => port.postMessage({ error: true })
      )
    )
  }
  if (type === 'REMINDER_STATUS' && port) {
    event.waitUntil(readState().then((state) => port.postMessage({ lastCheck: state.lastCheck })))
  }
})

// Opens the listing in the running app if there is one, else starts it.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url: string }).url
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows[0]
      return open ? open.navigate(url).then((w) => w?.focus()) : self.clients.openWindow(url)
    })
  )
})

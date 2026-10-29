// Periodic Background Sync (Chromium only, installed apps) isn't in TypeScript's DOM lib yet.
// Used by app/sw.ts and the Settings reminders card.
declare global {
  interface PeriodicSyncManager {
    register: (tag: string, options?: { minInterval: number }) => Promise<void>
    unregister: (tag: string) => Promise<void>
    getTags: () => Promise<string[]>
  }

  interface ServiceWorkerRegistration {
    readonly periodicSync?: PeriodicSyncManager
  }
}

export {}

<script setup lang="ts">
// Client-only reminders: the API has no push, so the service worker (app/sw.ts) checks deadlines
// and interviews through Periodic Background Sync. That only exists in installed Chromium apps,
// and the browser decides when it runs.
const TAG = 'reminders'
const TWELVE_HOURS = 12 * 60 * 60 * 1000

type Support = 'checking' | 'unsupported' | 'notInstalled' | 'ready'
const support = ref<Support>('checking')
const permission = ref<NotificationPermission>('default')
const enabled = ref(false)
const syncGranted = ref(true)
const requesting = ref(false)
const lastCheck = ref<string | null>(null)

// Asks the service worker over a MessageChannel; it answers on the port it was handed.
const ask = async <T,>(type: string) => {
  const worker = (await navigator.serviceWorker.ready).active!
  return new Promise<T>((resolve) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = (event) => resolve(event.data)
    worker.postMessage({ type }, [channel.port2])
  })
}

const read = async () => {
  if (!(
    'serviceWorker' in navigator &&
    'PeriodicSyncManager' in window &&
    'Notification' in window
  ))
    return (support.value = 'unsupported')
  if (!matchMedia('(display-mode: standalone)').matches) return (support.value = 'notInstalled')
  support.value = 'ready'
  permission.value = Notification.permission
  const sync = await navigator.permissions.query({
    name: 'periodic-background-sync' as PermissionName
  })
  syncGranted.value = sync.state === 'granted'
  const registration = await navigator.serviceWorker.getRegistration()
  const tags = (await registration?.periodicSync?.getTags()) ?? []
  enabled.value = permission.value === 'granted' && tags.includes(TAG)
  if (registration?.active)
    lastCheck.value = (await ask<{ lastCheck: string | null }>('REMINDER_STATUS')).lastCheck
}

const toggle = async (on: boolean) => {
  const { periodicSync } = await navigator.serviceWorker.ready
  if (!on) {
    await periodicSync!.unregister(TAG)
    enabled.value = false
    return
  }
  requesting.value = true
  permission.value = await Notification.requestPermission()
  requesting.value = false
  if (permission.value !== 'granted') return
  // Rejected until the browser grants background sync to this app; the alert explains that.
  enabled.value = await periodicSync!
    .register(TAG, { minInterval: TWELVE_HOURS })
    .then(() => true)
    .catch(() => false)
  syncGranted.value = enabled.value
}

const checking = ref(false)
const result = ref('')
const checkNow = async () => {
  checking.value = true
  const reply = await ask<{ sent: number; lastCheck: string } | { error: true }>('CHECK_REMINDERS')
  checking.value = false
  if ('error' in reply) {
    result.value = "Couldn't check. You may be offline or signed out. Try again."
    return
  }
  lastCheck.value = reply.lastCheck
  result.value = reply.sent
    ? `Checked just now. ${reply.sent} ${reply.sent === 1 ? 'reminder' : 'reminders'} sent.`
    : 'Checked just now. Nothing new is due.'
}

const description = computed(() => {
  if (requesting.value) return 'Waiting for your answer to the notification prompt…'
  if (permission.value === 'denied')
    return "Notifications are blocked for this app. Allow them in your device's app settings for Job Hunt, then come back."
  if (enabled.value)
    return 'On. Your device checks in the background about once a day, so a reminder can arrive late.'
  return 'Off. Your browser will ask for permission to send notifications.'
})

// Permissions change in the device's settings, outside the app.
const onVisible = () => document.visibilityState === 'visible' && read()
onMounted(() => {
  read()
  document.addEventListener('visibilitychange', onVisible)
})
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisible))
</script>

<template>
  <AppCard title="Reminders" data-testid="settings-reminders">
    <p class="mb-4 text-sm text-muted">
      Get a notification when a saved listing is due today or tomorrow, or an interview is within 24
      hours.
    </p>

    <USkeleton v-if="support === 'checking'" class="h-10 w-full" />

    <div
      v-else-if="support !== 'ready'"
      class="py-6 text-center text-muted"
      data-testid="reminders-unavailable"
    >
      <UIcon name="i-lucide-bell-off" class="mb-2 size-8" />
      <p v-if="support === 'unsupported'">
        Reminders aren't available in this browser. They work in the installed app in Chrome or
        Edge. iPhone, Safari and Firefox can't check in the background.
      </p>
      <p v-else>
        Install the app first: in Chrome, open the menu and choose Install app. Open it from your
        home screen, then turn reminders on here.
      </p>
    </div>

    <div v-else class="space-y-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <USwitch
          :model-value="enabled"
          label="Deadline and interview reminders"
          :description="description"
          :loading="requesting"
          :disabled="requesting || permission === 'denied'"
          data-testid="reminders-switch"
          @update:model-value="toggle"
        />
        <UButton
          v-if="permission === 'denied'"
          color="neutral"
          variant="subtle"
          class="self-start sm:self-center"
          @click="read"
          >Check again</UButton
        >
        <UButton
          v-else-if="permission === 'granted'"
          color="neutral"
          variant="subtle"
          class="self-start sm:self-center"
          :loading="checking"
          data-testid="reminders-check"
          @click="checkNow"
          >Check now</UButton
        >
      </div>

      <UAlert
        v-if="permission === 'granted' && !syncGranted"
        color="warning"
        variant="subtle"
        description="Notifications are allowed, but your device hasn't turned on background checks for this app yet. That usually happens after a few days of using the installed app. Use Check now to see what's due."
      />

      <div aria-live="polite" class="space-y-1 text-sm text-muted">
        <p v-if="result" data-testid="reminders-result">{{ result }}</p>
        <p v-if="lastCheck">Last check: {{ formatDateTime(lastCheck) }}</p>
      </div>
    </div>
  </AppCard>
</template>

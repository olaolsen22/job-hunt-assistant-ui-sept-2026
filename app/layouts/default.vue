<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'
import { useMediaQuery, useSwipe } from '@vueuse/core'

const auth = useAuthStore()
const route = useRoute()

const title = computed(() => route.meta.title)
useHead({ title })

// Asked once when the app opens; reviewing an import refreshes it by key.
const pendingImports = usePendingImportCount()

const items = computed<NavigationMenuItem[]>(() => [
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/' },
  { label: 'Job listings', icon: 'i-lucide-file-text', to: '/listings' },
  {
    label: 'Job imports',
    icon: 'i-lucide-inbox',
    to: '/listings/imports',
    badge: pendingImports.value || undefined
  },
  { label: 'Companies', icon: 'i-lucide-building-2', to: '/companies' },
  { label: 'People', icon: 'i-lucide-contact-round', to: '/contacts' },
  { label: 'Skills', icon: 'i-lucide-tags', to: '/skills' },
  { label: 'CV templates', icon: 'i-lucide-files', to: '/cv-templates' },
  { label: 'Profile', icon: 'i-lucide-user-round', to: '/profile' },
  { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' }
])

const colorMode = useColorMode()
// A nav item, not UColorModeButton, so it matches the links above it.
const themeItems = computed<NavigationMenuItem[]>(() => {
  const isDark = colorMode.value === 'dark'
  return [
    {
      label: isDark ? 'Dark mode' : 'Light mode',
      icon: isDark ? 'i-lucide-moon' : 'i-lucide-sun',
      onSelect: () => (colorMode.preference = isDark ? 'light' : 'dark')
    }
  ]
})

const displayName = computed(() => (auth.user?.role === 'Guest' ? 'Guest' : auth.user?.email))

const userItems = computed<DropdownMenuItem[][]>(() => [
  [{ label: displayName.value, type: 'label' }],
  [
    { label: 'Profile', icon: 'i-lucide-user-round', to: '/profile' },
    { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' }
  ],
  [{ label: 'Log out', icon: 'i-lucide-log-out', onSelect: logout }]
])

// The sidebar badge is out of sight on phones, so the dashboard also says when imports wait.
const showImportsNotice = computed(() => pendingImports.value > 0 && route.path === '/')

// Asks before leaving any page while a built-in AI request is still running.
const { open: aiLeaveOpen, leave: leaveDuringAi } = useAiLeaveGuard()

const logout = async () => {
  await auth.logout()
  await navigateTo('/login')
}

// Phones: swiping right opens the menu and swiping left closes it, like Slack or Discord. Swipes
// from either screen edge are left to the iOS/Android back gesture, and a swipe has to cover 30%
// of the screen so a small one doesn't toggle the menu by accident.
const sidebarOpen = ref(false)
// Nuxt UI's lg, where the sidebar stops being a mobile menu.
const isDesktop = useMediaQuery('(min-width: 64rem)')
const BACK_GESTURE_EDGE = 24
const SWIPE_SHARE = 0.3

// Swipes that start there belong to the element: scrolling it, selecting text, or a dialog.
const ownsSwipe = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false
  if (target.closest('input, textarea, [contenteditable], [role="dialog"]')) return true
  for (let el: Element | null = target; el; el = el.parentElement) {
    const { overflowX } = getComputedStyle(el)
    if (el.scrollWidth > el.clientWidth && (overflowX === 'auto' || overflowX === 'scroll'))
      return true
  }
  return false
}

let ignoreSwipe = false
const { coordsStart, lengthX } = useSwipe(window, {
  onSwipeStart: (e) => {
    const fromEdge =
      coordsStart.x < BACK_GESTURE_EDGE || coordsStart.x > window.innerWidth - BACK_GESTURE_EDGE
    // The open menu is itself a dialog, so only a closed menu checks where the swipe started.
    ignoreSwipe = isDesktop.value || fromEdge || (!sidebarOpen.value && ownsSwipe(e.target))
  },
  onSwipeEnd: (_, direction) => {
    if (ignoreSwipe || Math.abs(lengthX.value) < window.innerWidth * SWIPE_SHARE) return
    if (!sidebarOpen.value && direction === 'right') sidebarOpen.value = true
    else if (sidebarOpen.value && direction === 'left') sidebarOpen.value = false
  }
})
</script>

<template>
  <UDashboardGroup>
    <!-- Nuxt UI only animates the mobile slideover; desktop collapse would snap without this. -->
    <UDashboardSidebar v-model:open="sidebarOpen" collapsible class="transition-all duration-200">
      <template #header="{ collapsed }">
        <NuxtLink
          to="/"
          class="flex items-center gap-2 font-semibold"
          :class="{ 'mx-auto': collapsed }"
        >
          <UIcon name="i-lucide-briefcase" class="size-5 shrink-0 text-primary" />
          <span v-if="!collapsed" class="truncate">Job Hunt Assistant</span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu :items="items" :collapsed="collapsed" orientation="vertical" />
        <UNavigationMenu
          :items="themeItems"
          :collapsed="collapsed"
          orientation="vertical"
          class="mt-auto"
        />
      </template>
    </UDashboardSidebar>

    <UDashboardPanel class="bg-muted dark:bg-neutral-900/50">
      <template #header>
        <UDashboardNavbar :title="title" class="bg-default">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
          <template #right>
            <UDropdownMenu :items="userItems" :content="{ align: 'end' }">
              <UButton
                :avatar="{ icon: 'i-lucide-user' }"
                trailing-icon="i-lucide-chevron-down"
                color="neutral"
                variant="ghost"
                data-testid="current-user"
              >
                <!-- Icon-only on mobile; the menu's first line still shows who's signed in. -->
                <span class="hidden sm:inline">{{ displayName }}</span>
              </UButton>
            </UDropdownMenu>
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <!-- Width cap only; UDashboardPanel's body already supplies the side padding. -->
        <div class="mx-auto w-full max-w-(--ui-container)">
          <UAlert
            v-if="showImportsNotice"
            color="info"
            variant="subtle"
            icon="i-lucide-inbox"
            :title="`${pendingImports} job ${pendingImports === 1 ? 'import' : 'imports'} to review`"
            :actions="[{ label: 'Review imports', to: '/listings/imports', color: 'info' }]"
            orientation="horizontal"
            class="mb-4"
            data-testid="imports-notice"
          />
          <slot />
        </div>
      </template>
    </UDashboardPanel>

    <AppConfirmModal
      v-model:open="aiLeaveOpen"
      title="Leave while the AI is working?"
      description="Its answer will be lost, and the request may still count toward your daily AI limit."
      confirm-label="Leave"
      @confirm="leaveDuringAi"
    />
  </UDashboardGroup>
</template>

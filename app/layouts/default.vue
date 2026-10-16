<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'

const auth = useAuthStore()
const route = useRoute()

const title = computed(() => route.meta.title)
useHead({ title })

const items: NavigationMenuItem[] = [
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/' },
  { label: 'Job listings', icon: 'i-lucide-file-text', to: '/listings' },
  { label: 'Companies', icon: 'i-lucide-building-2', to: '/companies' },
  { label: 'Skills', icon: 'i-lucide-tags', to: '/skills' },
  { label: 'Profile', icon: 'i-lucide-user-round', to: '/profile' },
  { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' }
]

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

const logout = async () => {
  await auth.logout()
  await navigateTo('/login')
}
</script>

<template>
  <UDashboardGroup>
    <!-- Nuxt UI only animates the mobile slideover; desktop collapse would snap without this. -->
    <UDashboardSidebar collapsible class="transition-all duration-200">
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
          <slot />
        </div>
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>

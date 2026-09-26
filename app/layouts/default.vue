<script setup lang="ts">
const auth = useAuthStore()

async function logout() {
  await auth.logout()
  await navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen">
    <header class="border-b border-default">
      <UContainer class="flex h-14 items-center justify-between">
        <NuxtLink to="/" class="font-semibold">Job Hunt Assistant</NuxtLink>
        <div class="flex items-center gap-2">
          <template v-if="auth.user">
            <span
              class="max-w-40 truncate text-sm text-muted sm:max-w-none"
              data-testid="current-user"
            >
              {{ auth.user.role === 'Guest' ? 'Guest' : auth.user.email }}
            </span>
            <UButton
              icon="i-lucide-log-out"
              color="neutral"
              variant="ghost"
              aria-label="Log out"
              @click="logout"
            />
          </template>
          <UColorModeButton />
        </div>
      </UContainer>
    </header>
    <UContainer as="main" class="py-8">
      <slot />
    </UContainer>
  </div>
</template>

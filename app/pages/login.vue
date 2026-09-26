<script setup lang="ts">
import type { FetchError } from 'ofetch'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

useHead({ title: 'Sign in' })

const auth = useAuthStore()
const pending = ref<'login' | 'guest' | null>(null)
const errorMessage = ref('')

const fields: AuthFormField[] = [
  { name: 'email', type: 'email', label: 'Email', placeholder: 'you@example.com', required: true },
  { name: 'password', type: 'password', label: 'Password', required: true }
]

const providers = computed(() => [
  {
    label: 'Continue as guest',
    icon: 'i-lucide-user-round',
    color: 'neutral' as const,
    variant: 'subtle' as const,
    loading: pending.value === 'guest',
    disabled: pending.value !== null,
    onClick: () => signIn('guest', () => auth.loginAsGuest())
  }
])

async function signIn(kind: 'login' | 'guest', action: () => Promise<void>) {
  pending.value = kind
  errorMessage.value = ''
  try {
    await action()
    await navigateTo('/')
  } catch (e) {
    const status = (e as FetchError).statusCode
    if (status === 401) errorMessage.value = 'Invalid email or password.'
    // Both endpoints are rate-limited per IP, and login also locks the account after 5 tries.
    else if (status === 429) errorMessage.value = 'Too many attempts. Try again in a few minutes.'
    else errorMessage.value = 'Something went wrong. Try again.'
  } finally {
    pending.value = null
  }
}

function onSubmit(event: FormSubmitEvent<{ email: string; password: string }>) {
  signIn('login', () => auth.login(event.data.email, event.data.password))
}
</script>

<template>
  <div class="flex justify-center pt-8">
    <UCard class="w-full max-w-sm">
      <UAuthForm
        title="Sign in"
        icon="i-lucide-lock"
        :fields="fields"
        :providers="providers"
        :submit="{ label: 'Sign in' }"
        :loading="pending === 'login'"
        :disabled="pending !== null"
        @submit="onSubmit"
      >
        <template #validation>
          <UAlert
            v-if="errorMessage"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="errorMessage"
            data-testid="login-error"
          />
        </template>
      </UAuthForm>
    </UCard>
  </div>
</template>

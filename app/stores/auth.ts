import type { FetchError } from 'ofetch'

export interface AuthUser {
  id: string
  email: string
  role: 'Owner' | 'Guest'
}

// requiresTwoFactor is also returned but ignored until the API implements 2FA.
interface LoginResponse {
  user: AuthUser
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)

  async function fetchMe() {
    try {
      user.value = await $fetch<AuthUser>('/api/auth/me')
    } catch (e) {
      // 401 just means no session; anything else is a real failure.
      if ((e as FetchError).statusCode !== 401) throw e
      user.value = null
    }
  }

  async function login(email: string, password: string) {
    const res = await $fetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: { email, password }
    })
    user.value = res.user
  }

  async function loginAsGuest() {
    const res = await $fetch<LoginResponse>('/api/auth/guest', { method: 'POST' })
    user.value = res.user
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
  }

  return { user, fetchMe, login, loginAsGuest, logout }
})

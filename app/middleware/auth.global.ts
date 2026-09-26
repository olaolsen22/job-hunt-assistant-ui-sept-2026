export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  if (!auth.user) await auth.fetchMe()

  if (!auth.user && to.path !== '/login') return navigateTo('/login')
  if (auth.user && to.path === '/login') return navigateTo('/')
})

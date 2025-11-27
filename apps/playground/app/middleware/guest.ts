export default defineNuxtRouteMiddleware(() => {
  const { loggedIn, options } = useAuth()

  if (loggedIn.value) {
    return navigateTo(options.redirectUserTo || '/app')
  }
})

<script setup lang="ts">
const { user, signOut } = useAuth()
const colorMode = useColorMode()

const items = computed(() => ([
  [
    {
      type: 'label' as const,
      label: user.value?.name || '',
      avatar: {
        src: user.value?.image || '',
        alt: user.value?.name || '',
      },
    },
  ],
  [
    {
      label: 'Appearance',
      icon: 'i-lucide-sun-moon',
      children: [
        {
          label: 'Light',
          icon: 'i-lucide-sun',
          type: 'checkbox' as const,
          checked: colorMode.value === 'light',
          onSelect(e: Event) {
            e.preventDefault()
            colorMode.preference = 'light'
          },
        },
        {
          label: 'Dark',
          icon: 'i-lucide-moon',
          type: 'checkbox' as const,
          checked: colorMode.value === 'dark',
          onUpdateChecked(checked: boolean) {
            if (checked) {
              colorMode.preference = 'dark'
            }
          },
          onSelect(e: Event) {
            e.preventDefault()
          },
        },
      ],
    },
  ],
  [
    {
      label: 'Log out',
      icon: 'i-lucide-log-out',
      onSelect: () => {
        signOut({ redirectTo: '/' })
      },
    },
  ],
]))
</script>

<template>
  <div class="min-h-dvh flex flex-col bg-default">
    <header class="sticky top-0 z-50 border-b border-default bg-elevated/80 backdrop-blur-sm">
      <div class="flex h-14 items-center justify-between px-4 lg:px-6">
        <NuxtLink
          to="/app"
          class="flex items-center gap-2"
        >
          <UIcon
            name="i-lucide-check-square"
            class="size-6 text-primary"
          />
          <span class="font-semibold text-lg">Playground</span>
        </NuxtLink>

        <UDropdownMenu
          :items
          :content="{ align: 'end', collisionPadding: 12 }"
          :ui="{ content: 'w-48' }"
        >
          <UButton
            color="neutral"
            variant="ghost"
            class="gap-2"
          >
            <UAvatar
              v-if="user?.image"
              :src="user.image"
              :alt="user?.name || ''"
              size="2xs"
            />
            <span class="hidden sm:inline">{{ user?.name }}</span>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-4 text-muted"
            />
          </UButton>
        </UDropdownMenu>
      </div>
    </header>

    <main class="flex-1 p-4 lg:p-6">
      <div class="mx-auto max-w-3xl">
        <slot />
      </div>
    </main>

    <footer class="border-t border-default py-4 text-center text-sm text-muted">
      <p>MCP Toolkit Playground</p>
    </footer>
  </div>
</template>

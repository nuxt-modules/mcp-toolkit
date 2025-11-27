<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, TabsItem } from '@nuxt/ui'

definePageMeta({
  middleware: ['guest'],
  layout: 'auth',
})

const auth = useAuth()
const toast = useToast()
const loading = ref(false)

const items = ref<TabsItem[]>([
  {
    label: 'Sign in',
    slot: 'signin',
  },
  {
    label: 'Sign up',
    slot: 'signup',
  },
])

const signInFields = [
  {
    name: 'email',
    type: 'text' as const,
    label: 'Email',
    placeholder: 'Enter your email',
    required: true,
  },
  {
    name: 'password',
    label: 'Password',
    type: 'password' as const,
    placeholder: 'Enter your password',
    required: true,
  },
]

const signUpFields = [
  ...signInFields,
  {
    name: 'name',
    label: 'Name',
    placeholder: 'Enter your name',
    required: true,
  },
]

const providers = [
  {
    label: 'GitHub',
    icon: 'i-simple-icons-github',
    onClick: () => {
      auth.signIn.social({ provider: 'github', callbackURL: '/app' })
    },
  },
]

const signInSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Must be at least 8 characters'),
})

const signUpSchema = z.object({
  ...signInSchema.shape,
  name: z.string().min(1, 'Name is required'),
})

type SignInSchema = z.output<typeof signInSchema>
type SignUpSchema = z.output<typeof signUpSchema>

async function onSignIn(payload: FormSubmitEvent<SignInSchema>) {
  try {
    loading.value = true
    const { data, error } = await auth.signIn.email({
      email: payload.data.email,
      password: payload.data.password,
    })
    if (data) {
      toast.add({
        title: 'Successfully signed in',
        color: 'success',
      })
      await navigateTo('/app')
    }
    else {
      toast.add({
        title: error.message,
        color: 'error',
      })
    }
  }
  catch (error: unknown) {
    const err = error as Error
    toast.add({
      title: err.message,
      color: 'error',
    })
  }
  finally {
    loading.value = false
  }
}

async function onSignUp(payload: FormSubmitEvent<SignUpSchema>) {
  try {
    loading.value = true
    const { data, error } = await auth.signUp.email({
      email: payload.data.email,
      password: payload.data.password,
      name: payload.data.name,
    })
    if (data) {
      toast.add({
        title: 'Successfully signed up',
        color: 'success',
      })
      await navigateTo('/app')
    }
    else {
      toast.add({
        title: error.message,
        color: 'error',
      })
    }
  }
  catch (error: unknown) {
    const err = error as Error
    toast.add({
      title: err.message,
      color: 'error',
    })
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center gap-4 p-4">
    <div class="flex items-center justify-center gap-2">
      <UIcon
        name="i-lucide-check-square"
        class="size-10 text-primary"
      />
      <span class="font-bold text-2xl">Playground</span>
    </div>
    <UPageCard class="relative w-full max-w-md bg-muted/20">
      <UTabs
        :items
        variant="link"
        :ui="{ list: 'mb-4' }"
      >
        <template #signin>
          <UAuthForm
            :schema="signInSchema"
            title="Login"
            description="Enter your credentials to access your account."
            :fields="signInFields"
            :providers
            :loading
            :ui="{
              title: 'text-left',
              description: 'text-left',
            }"
            @submit="onSignIn"
          />
        </template>
        <template #signup>
          <UAuthForm
            :schema="signUpSchema"
            title="Sign up"
            description="Create an account to manage your todos."
            :fields="signUpFields"
            :providers
            :loading
            :ui="{
              title: 'text-left',
              description: 'text-left',
            }"
            @submit="onSignUp"
          />
        </template>
      </UTabs>
    </UPageCard>
  </div>
</template>

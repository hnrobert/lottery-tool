<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import API from '@/api'

const emits = defineEmits<{
  (e: 'submit', payload: { username: string; email: string; password: string }): void
}>()

const username = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
// 注册是否开放（系统未初始化时恒开放——等待首位超级管理员注册）
const registrationOpen = ref(true)
const loaded = ref(false)

onMounted(async () => {
  try {
    const status = await API.auth.registrationStatus()
    registrationOpen.value = !status.initialized || status.registration_enabled
  } catch {
    registrationOpen.value = true // 保守放行表单，后端仍会拦截
  } finally {
    loaded.value = true
  }
})

const validate = (): boolean => {
  if (!/^[a-zA-Z0-9_]{3,50}$/.test(username.value)) {
    error.value = '用户名需为 3-50 位字母、数字或下划线'
    return false
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    error.value = '请输入有效的邮箱地址'
    return false
  }
  if (!/^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(password.value)) {
    error.value = '密码至少 6 位且需包含字母和数字'
    return false
  }
  if (password.value !== confirmPassword.value) {
    error.value = '两次输入的密码不一致'
    return false
  }
  error.value = ''
  return true
}

const onSubmit = (e: Event) => {
  e.preventDefault()
  if (validate()) {
    emits('submit', { username: username.value, email: email.value, password: password.value })
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <form @submit="onSubmit">
      <div class="flex flex-col gap-6">
        <div class="flex flex-col items-center gap-2">
          <h1 class="text-xl font-bold">Lottery Tool</h1>
          <div class="text-center text-sm">
            Already have an account?
            <RouterLink :to="{ name: 'Login' }" class="underline underline-offset-4">
              Log in
            </RouterLink>
          </div>
        </div>

        <!-- 注册已关闭 -->
        <div v-if="loaded && !registrationOpen" class="text-center text-sm text-muted-foreground">
          系统已关闭注册，请联系管理员开通账户。
        </div>

        <div v-else class="flex flex-col gap-6">
          <div class="grid gap-2">
            <Label html-for="username">Username</Label>
            <Input
              id="username"
              v-model="username"
              type="text"
              placeholder="3-50 位字母、数字或下划线"
              required
            />
          </div>
          <div class="grid gap-2">
            <Label html-for="email">Email</Label>
            <Input id="email" v-model="email" type="email" placeholder="you@example.com" required />
          </div>
          <div class="grid gap-2">
            <Label html-for="password">Password</Label>
            <Input
              id="password"
              v-model="password"
              type="password"
              placeholder="至少 6 位，包含字母和数字"
              required
            />
          </div>
          <div class="grid gap-2">
            <Label html-for="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              v-model="confirmPassword"
              type="password"
              placeholder="再输入一次密码"
              required
            />
          </div>
          <p v-if="error" class="text-sm text-destructive">
            {{ error }}
          </p>
          <Button type="submit" class="w-full"> Sign up </Button>
        </div>
      </div>
    </form>
    <div class="text-balance text-center text-xs text-muted-foreground">
      首位注册的用户将自动成为超级管理员；系统完成初始化后，注册开放与否由管理员设置。
    </div>
  </div>
</template>

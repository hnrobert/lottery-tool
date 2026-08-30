<template>
  <div>
    <PageTitle :title="'Settings'" />

    <!-- 系统注册开关（仅超级管理员可见可改） -->
    <div
      v-if="userStore.role === 'super_admin'"
      class="flex items-center justify-between rounded-lg border p-4"
    >
      <div class="space-y-0.5">
        <div class="text-sm font-medium">开放系统注册</div>
        <div class="text-xs text-muted-foreground">
          开启后任何人可通过注册页创建普通管理员账户；关闭后前端不显示注册入口。
        </div>
      </div>
      <button
        type="button"
        role="switch"
        :aria-checked="registrationEnabled"
        :disabled="switching"
        :class="[
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          registrationEnabled ? 'bg-blue-600' : 'bg-gray-200',
        ]"
        @click="handleToggle(!registrationEnabled)"
      >
        <span
          :class="[
            'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
            registrationEnabled ? 'translate-x-5' : 'translate-x-0',
          ]"
        />
      </button>
    </div>
    <div v-else class="text-sm text-muted-foreground">系统设置仅超级管理员可管理。</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import PageTitle from '@/components/ui/text/pageTitle.vue'
import API from '@/api'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const registrationEnabled = ref(true)
const switching = ref(false)

onMounted(async () => {
  try {
    const res = await API.system.getRegistration()
    registrationEnabled.value = res.registration_enabled
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '获取注册设置失败')
  }
})

const handleToggle = async (value: boolean) => {
  switching.value = true
  try {
    const res = await API.system.setRegistration(value)
    registrationEnabled.value = res.registration_enabled
    toast.success(value ? '系统注册已开启' : '系统注册已关闭')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '设置失败')
  } finally {
    switching.value = false
  }
}
</script>

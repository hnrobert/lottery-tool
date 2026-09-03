<template>
  <div class="space-y-6">
    <PageTitle title="Activities" />

    <!-- 筛选和搜索栏 -->
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <!-- 搜索框 -->
        <div class="relative">
          <Search
            class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4"
          />
          <Input
            v-model="searchQuery"
            placeholder="Search..."
            class="pl-10 w-64"
            @input="handleSearch"
          />
        </div>

        <!-- 状态筛选 -->
        <Select v-model="statusFilter" @update:model-value="handleStatusFilter">
          <SelectTrigger class="w-32">
            <SelectValue placeholder="States" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">State</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="ended">Ended</SelectItem>
          </SelectContent>
        </Select>

        <!-- 模式筛选 -->
        <Select v-model="modeFilter" @update:model-value="handleModeFilter">
          <SelectTrigger class="w-32">
            <SelectValue placeholder="Mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- 创建按钮 -->
      <Button class="whitespace-nowrap" @click="handleCreateActivity">
        <Plus class="h-4 w-4 mr-2" />
        Create
      </Button>
    </div>

    <!-- 数据表格 -->
    <DataTable
      :data="activities"
      :columns="columns"
      :loading="loading"
      :pagination="{
        current: currentPage,
        pageSize: 10,
        total: totalPages * 10,
      }"
      :empty-text="'Null'"
      @page-change="handlePageChange"
    />

    <!-- 抽奖界面演示 Dialog -->
    <Dialog :open="showDemoDialog" @update:open="(v: boolean) => (showDemoDialog = v)">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>抽奖界面演示</DialogTitle>
          <DialogDescription>
            使用测试抽奖码在真实抽奖页体验完整流程：不扣减奖品库存、不产生抽奖记录，可反复抽。
          </DialogDescription>
        </DialogHeader>

        <div v-if="demoLoading" class="py-6 text-center text-sm text-muted-foreground">
          正在准备测试抽奖码...
        </div>
        <div v-else-if="demoError" class="py-6 text-center text-sm text-destructive">
          {{ demoError }}
        </div>
        <div v-else-if="demoCode" class="space-y-4">
          <div class="space-y-1.5">
            <div class="text-xs text-muted-foreground">测试抽奖码（活动固定一个，可反复使用）</div>
            <div class="flex items-center gap-2">
              <!-- min-w-0 + break-all：flex 子项默认 min-width:auto 会撑破容器 -->
              <code
                class="min-w-0 flex-1 rounded-md border bg-muted px-3 py-2 text-center font-mono text-lg font-bold tracking-widest break-all"
              >
                {{ demoCode }}
              </code>
              <Button
                variant="outline"
                size="sm"
                class="shrink-0"
                @click="copyText(demoCode, '抽奖码已复制')"
              >
                复制
              </Button>
            </div>
          </div>

          <div class="space-y-1.5">
            <div class="text-xs text-muted-foreground">抽奖页链接（自动填入测试码）</div>
            <div class="flex items-center gap-2">
              <code
                class="min-w-0 flex-1 truncate rounded-md border bg-muted px-3 py-2 font-mono text-xs"
              >
                {{ demoUrl }}
              </code>
              <Button
                variant="outline"
                size="sm"
                class="shrink-0"
                @click="copyText(demoUrl, '链接已复制')"
              >
                复制
              </Button>
            </div>
            <Button class="w-full" @click="openDemoUrl">
              <Play class="mr-1 h-4 w-4" />
              打开抽奖页
            </Button>
          </div>

          <p class="text-xs leading-relaxed text-muted-foreground">
            提示：活动需处于「进行中」状态，否则抽奖页会提示活动未开始；线下抽奖模式需管理员登录后操作。
          </p>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, h } from 'vue'
import { useRouter } from 'vue-router'
import { useDebounceFn } from '@vueuse/core'
import PageTitle from '@/components/ui/text/pageTitle.vue'
import DataTable from '@/components/common/DataTable.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Plus, Trash, SquarePen, Eye, Play } from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'vue-sonner'
import { API } from '@/api'
import type { Activity } from '@/types/api'
import type { TableColumn } from '@/components/common/types'

const router = useRouter()

// 响应式数据
const activities = ref<Activity[]>([])
const loading = ref(false)
const currentPage = ref(1)
const totalPages = ref(0)
const searchQuery = ref('')
const statusFilter = ref('all')
const modeFilter = ref('all')

// 状态徽章配置
const getStatusBadge = (status: string) => {
  const statusMap = {
    draft: { label: 'Draft', variant: 'secondary' as const },
    active: { label: 'Active', variant: 'default' as const },
    ended: { label: 'Ended', variant: 'destructive' as const },
  }
  return (
    statusMap[status as keyof typeof statusMap] || { label: status, variant: 'secondary' as const }
  )
}

// 模式徽章配置
const getModeBadge = (mode: string) => {
  const modeMap = {
    online: { label: 'Online', variant: 'default' as const },
    offline: { label: 'Offline', variant: 'secondary' as const },
  }
  return modeMap[mode as keyof typeof modeMap] || { label: mode, variant: 'secondary' as const }
}

// 时间格式化
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 表格列配置
const columns = computed<TableColumn[]>(() => [
  {
    key: 'name',
    title: '活动名称',
    width: '200px',
  },
  {
    key: 'status',
    title: '状态',
    width: '100px',
    render: (value: unknown, record: Record<string, unknown>) => {
      const activity = record as unknown as Activity
      const badge = getStatusBadge(activity.status)
      return `<span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-${badge.variant === 'default' ? 'primary' : badge.variant === 'secondary' ? 'secondary' : 'muted'} text-${badge.variant === 'default' ? 'primary-foreground' : 'foreground'}">${badge.label}</span>`
    },
  },
  {
    key: 'lottery_mode',
    title: '抽奖模式',
    width: '100px',
    render: (value: unknown, record: Record<string, unknown>) => {
      const activity = record as unknown as Activity
      const badge = getModeBadge(activity.lottery_mode)
      return `<span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-${badge.variant === 'default' ? 'primary' : 'secondary'} text-${badge.variant === 'default' ? 'primary-foreground' : 'foreground'}">${badge.label}</span>`
    },
  },
  {
    key: 'start_time',
    title: '开始时间',
    width: '150px',
    render: (value: unknown, record: Record<string, unknown>) => {
      const activity = record as unknown as Activity
      return activity.start_time ? formatDate(activity.start_time) : '-'
    },
  },
  {
    key: 'end_time',
    title: '结束时间',
    width: '150px',
    render: (value: unknown, record: Record<string, unknown>) => {
      const activity = record as unknown as Activity
      return activity.end_time ? formatDate(activity.end_time) : '-'
    },
  },
  {
    key: 'created_at',
    title: '创建时间',
    width: '150px',
    render: (value: unknown, record: Record<string, unknown>) => {
      const activity = record as unknown as Activity
      return formatDate(activity.created_at)
    },
  },
  {
    key: 'actions',
    title: '操作',
    width: '160px',
    render: (value: unknown, record: Record<string, unknown>) => {
      const activity = record as unknown as Activity
      return h('div', { class: 'flex items-center gap-2' }, [
        h(
          'button',
          {
            class:
              'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8',
            title: '查看详情',
            onClick: () => handleViewActivity(String(activity.id)),
          },
          [h(Eye, { size: 16 })],
        ),
        h(
          'button',
          {
            class:
              'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8',
            title: '编辑',
            onClick: () => handleEditActivity(String(activity.id)),
          },
          [h(SquarePen, { size: 16 })],
        ),
        h(
          'button',
          {
            class:
              'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8',
            title: '抽奖界面演示',
            onClick: () => handleDemoActivity(String(activity.id)),
          },
          [h(Play, { size: 16 })],
        ),
        h(
          'button',
          {
            class:
              'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground text-destructive hover:text-destructive h-8 w-8',
            title: '删除',
            onClick: () => handleDeleteActivity(String(activity.id)),
          },
          [h(Trash, { size: 16, color: 'red' })],
        ),
      ])
    },
  },
])

// 获取活动列表
const fetchActivities = async () => {
  try {
    loading.value = true

    const params: any = {
      page: currentPage.value,
      limit: 10,
    }

    // 添加搜索条件
    if (searchQuery.value.trim()) {
      params.search = searchQuery.value.trim()
    }

    // 添加状态筛选
    if (statusFilter.value !== 'all') {
      params.status = statusFilter.value
    }

    // 添加模式筛选
    if (modeFilter.value !== 'all') {
      params.lottery_mode = modeFilter.value
    }

    const response = await API.adminActivity.getActivities(params)

    activities.value = response.activities
    totalPages.value = response.pagination.totalPages
  } catch (error) {
    console.error('获取活动列表出错:', error)
    activities.value = []
  } finally {
    loading.value = false
  }
}

// 事件处理函数
const handleSearchInternal = () => {
  currentPage.value = 1
  fetchActivities()
}

// 使用防抖包装搜索函数
const handleSearch = useDebounceFn(handleSearchInternal, 1000)

const handleStatusFilter = () => {
  currentPage.value = 1
  fetchActivities()
}

const handleModeFilter = () => {
  currentPage.value = 1
  fetchActivities()
}

const handlePageChange = (page: number) => {
  currentPage.value = page
  fetchActivities()
}

// 操作处理函数
const handleCreateActivity = () => {
  router.push('/admin/activities/create')
}

const handleViewActivity = (id: string) => {
  router.push(`/admin/activities/detail/${id}`)
}

const handleEditActivity = (id: string) => {
  router.push(`/admin/activities/edit/${id}`)
}

const handleDeleteActivity = async (id: string) => {
  if (confirm('确定要删除这个活动吗？此操作不可撤销。')) {
    try {
      await API.adminActivity.deleteActivity(Number(id))
      await fetchActivities()
    } catch (error) {
      console.error('删除活动出错:', error)
      alert('删除失败，请稍后重试')
    }
  }
}

// ---- 抽奖界面演示 ----
const showDemoDialog = ref(false)
const demoLoading = ref(false)
const demoError = ref('')
const demoCode = ref('')
const demoActivityId = ref(0)
const demoUrl = computed(
  () => `${location.origin}/lottery?activityId=${demoActivityId.value}&code=${demoCode.value}`,
)

const handleDemoActivity = async (id: string) => {
  demoActivityId.value = Number(id)
  showDemoDialog.value = true
  demoLoading.value = true
  demoError.value = ''
  demoCode.value = ''
  try {
    const res = await API.adminActivity.ensureDemoCode(Number(id))
    demoCode.value = res.lottery_code.code
  } catch (error) {
    demoError.value = error instanceof Error ? error.message : '获取测试抽奖码失败'
  } finally {
    demoLoading.value = false
  }
}

const copyText = async (text: string, successMessage: string) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    } else {
      // 非安全上下文（如局域网 http）回退：隐藏 textarea + execCommand
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    toast.success(successMessage)
  } catch {
    toast.error('复制失败，请手动复制')
  }
}

const openDemoUrl = () => {
  window.open(demoUrl.value, '_blank')
}

// 组件挂载时获取数据
onMounted(() => {
  fetchActivities()
})
</script>

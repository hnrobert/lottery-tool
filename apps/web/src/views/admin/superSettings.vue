<template>
  <div class="space-y-6">
    <PageTitle title="超级管理员设置" subTitle="系统级参数配置，仅超级管理员可访问" />

    <!-- COS 配置卡片（只读） -->
    <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div class="flex flex-col space-y-1.5 p-6 border-b">
        <h3 class="text-lg font-semibold leading-none tracking-tight">腾讯云 COS 配置</h3>
        <p class="text-sm text-muted-foreground">
          线下抽奖的签字图片将上传至 COS 存储。密钥仅保存在服务端，不会下发到浏览器。
        </p>
      </div>

      <div class="p-6 space-y-4">
        <!-- 配置说明 -->
        <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
          <p class="font-medium mb-1">COS 配置仅通过服务端环境变量设置</p>
          <p class="text-blue-700">
            请在服务端的 <code class="px-1 py-0.5 bg-blue-100 rounded">.env</code> 文件中配置以下变量后重启服务：
            <code class="px-1 py-0.5 bg-blue-100 rounded">COS_SECRET_ID</code>、
            <code class="px-1 py-0.5 bg-blue-100 rounded">COS_SECRET_KEY</code>、
            <code class="px-1 py-0.5 bg-blue-100 rounded">COS_BUCKET</code>、
            <code class="px-1 py-0.5 bg-blue-100 rounded">COS_REGION</code>，
            可选 <code class="px-1 py-0.5 bg-blue-100 rounded">COS_CUSTOM_DOMAIN</code>、
            <code class="px-1 py-0.5 bg-blue-100 rounded">COS_PATH_PREFIX</code>。
            参考 <code class="px-1 py-0.5 bg-blue-100 rounded">apps/service/.env.example</code>。
          </p>
        </div>

        <!-- 加载错误 -->
        <div v-if="loadError" class="text-red-500 text-sm bg-red-50 p-3 rounded-lg">
          {{ loadError }}
        </div>

        <!-- 配置状态 -->
        <div v-if="!loading && !loadError">
          <div v-if="hasConfig" class="space-y-3">
            <div class="flex items-center gap-2 text-green-600">
              <span class="inline-block w-2 h-2 rounded-full bg-green-500"></span>
              <span class="font-medium">COS 已配置</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div class="space-y-1">
                <span class="text-muted-foreground">SecretId</span>
                <div class="font-mono bg-muted px-3 py-2 rounded">{{ config.secret_id || '-' }}</div>
              </div>
              <div class="space-y-1">
                <span class="text-muted-foreground">SecretKey</span>
                <div class="font-mono bg-muted px-3 py-2 rounded">{{ config.secret_key || '-' }}</div>
              </div>
              <div class="space-y-1">
                <span class="text-muted-foreground">Bucket</span>
                <div class="font-mono bg-muted px-3 py-2 rounded">{{ config.bucket || '-' }}</div>
              </div>
              <div class="space-y-1">
                <span class="text-muted-foreground">Region</span>
                <div class="font-mono bg-muted px-3 py-2 rounded">{{ config.region || '-' }}</div>
              </div>
              <div class="space-y-1">
                <span class="text-muted-foreground">自定义域名</span>
                <div class="font-mono bg-muted px-3 py-2 rounded">{{ config.custom_domain || '-' }}</div>
              </div>
              <div class="space-y-1">
                <span class="text-muted-foreground">对象前缀</span>
                <div class="font-mono bg-muted px-3 py-2 rounded">{{ config.path_prefix || '-' }}</div>
              </div>
            </div>
          </div>
          <div v-else class="flex items-center gap-2 text-amber-600">
            <span class="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
            <span class="font-medium">COS 未配置，线下抽奖签字功能将不可用</span>
          </div>
        </div>

        <!-- 加载中 -->
        <div v-if="loading" class="text-sm text-muted-foreground">
          正在加载配置...
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import PageTitle from '@/components/ui/text/pageTitle.vue';
import { systemApi } from '@/api';
import type { CosConfig } from '@/types/api';

const config = ref<CosConfig>({
  secret_id: '',
  secret_key: '',
  bucket: '',
  region: '',
  custom_domain: '',
  path_prefix: '',
});
const hasConfig = ref(false);
const loading = ref(true);
const loadError = ref('');

const loadConfig = async () => {
  try {
    loading.value = true;
    const response = await systemApi.getCosConfig();
    hasConfig.value = response.configured;
    if (response.config) {
      config.value = response.config;
    }
    loadError.value = '';
  } catch (err: any) {
    loadError.value = err?.message || '加载配置失败';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadConfig();
});
</script>

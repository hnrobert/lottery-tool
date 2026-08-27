<template>
  <div class="space-y-6">
    <PageTitle title="超级管理员设置" subTitle="配置系统级参数，仅超级管理员可访问" />

    <!-- COS 配置卡片 -->
    <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div class="flex flex-col space-y-1.5 p-6 border-b">
        <h3 class="text-lg font-semibold leading-none tracking-tight">腾讯云 COS 配置</h3>
        <p class="text-sm text-muted-foreground">
          配置后，线下抽奖的签字图片将上传至 COS 存储。密钥仅保存在服务端，不会下发到浏览器。
        </p>

        <!-- 环境变量配置提示 -->
        <div v-if="envConfigured" class="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          <p class="font-medium mb-1">当前 COS 配置来自环境变量（.env 中的 COS_* 变量）</p>
          <p class="text-amber-700">环境变量优先级高于本页面配置。如需修改，请编辑服务端的 .env 文件并重启服务。本页面保存的配置仅在环境变量未设置时生效。</p>
        </div>
        <div v-else class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
          <p class="font-medium mb-1">推荐使用环境变量配置 COS</p>
          <p class="text-blue-700">敏感配置（如 SecretKey）推荐通过 .env 环境变量管理（COS_SECRET_ID、COS_SECRET_KEY、COS_BUCKET、COS_REGION 等），更安全且便于多环境部署。参考 apps/service/.env.example。</p>
        </div>
      </div>

      <div class="p-6 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="secret_id">SecretId</Label>
            <Input
              id="secret_id"
              v-model="form.secret_id"
              placeholder="请输入 SecretId"
              :disabled="isSaving"
            />
          </div>

          <div class="space-y-2">
            <Label for="secret_key">SecretKey</Label>
            <Input
              id="secret_key"
              v-model="form.secret_key"
              type="password"
              :placeholder="hasConfig ? '留空表示不修改' : '请输入 SecretKey'"
              :disabled="isSaving"
            />
            <p v-if="hasConfig" class="text-xs text-muted-foreground">当前已配置 SecretKey，留空则保持不变</p>
          </div>

          <div class="space-y-2">
            <Label for="bucket">Bucket</Label>
            <Input
              id="bucket"
              v-model="form.bucket"
              placeholder="格式：bucketname-appid，例如 mybucket-1250000000"
              :disabled="isSaving"
            />
          </div>

          <div class="space-y-2">
            <Label for="region">Region</Label>
            <Input
              id="region"
              v-model="form.region"
              placeholder="例如 ap-guangzhou"
              :disabled="isSaving"
            />
          </div>

          <div class="space-y-2">
            <Label for="custom_domain">自定义域名（可选）</Label>
            <Input
              id="custom_domain"
              v-model="form.custom_domain"
              placeholder="例如 https://cdn.example.com"
              :disabled="isSaving"
            />
          </div>

          <div class="space-y-2">
            <Label for="path_prefix">对象前缀（可选）</Label>
            <Input
              id="path_prefix"
              v-model="form.path_prefix"
              placeholder="例如 lottery-signatures"
              :disabled="isSaving"
            />
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="flex items-center gap-3 pt-4 border-t">
          <Button
            type="button"
            @click="handleSave"
            :disabled="isSaving"
            class="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
          >
            <Loader2 v-if="isSaving" class="w-4 h-4 mr-1 animate-spin" />
            <Save v-else class="w-4 h-4 mr-1" />
            保存配置
          </Button>

          <Button
            type="button"
            variant="outline"
            @click="handleTest"
            :disabled="isTesting || !hasConfig"
          >
            <Loader2 v-if="isTesting" class="w-4 h-4 mr-1 animate-spin" />
            <Zap v-else class="w-4 h-4 mr-1" />
            测试连接
          </Button>

          <div v-if="testResult" class="text-sm" :class="testResult.success ? 'text-green-600' : 'text-red-600'">
            {{ testResult.message }}
          </div>
        </div>

        <!-- 配置状态提示 -->
        <div v-if="loadError" class="text-red-500 text-sm bg-red-50 p-3 rounded-lg">
          {{ loadError }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { toast } from 'vue-sonner';
import PageTitle from '@/components/ui/text/pageTitle.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Zap, Loader2 } from 'lucide-vue-next';
import { systemApi } from '@/api';
import type { CosConfig } from '@/types/api';

const form = ref<CosConfig>({
  secret_id: '',
  secret_key: '',
  bucket: '',
  region: '',
  custom_domain: '',
  path_prefix: '',
});

const isSaving = ref(false);
const isTesting = ref(false);
const hasConfig = ref(false);
const envConfigured = ref(false);
const loadError = ref('');
const testResult = ref<{ success: boolean; message: string } | null>(null);

const loadConfig = async () => {
  try {
    const response = await systemApi.getCosConfig();
    hasConfig.value = response.configured;
    envConfigured.value = response.env_configured || false;
    if (response.config) {
      form.value.secret_id = response.config.secret_id || '';
      form.value.secret_key = ''; // 不回显密钥
      form.value.bucket = response.config.bucket || '';
      form.value.region = response.config.region || '';
      form.value.custom_domain = response.config.custom_domain || '';
      form.value.path_prefix = response.config.path_prefix || '';
    }
  } catch (err) {
    loadError.value = '加载配置失败，请刷新页面重试';
    console.error('加载COS配置失败:', err);
  }
};

const handleSave = async () => {
  if (!form.value.secret_id && !hasConfig.value) {
    toast.error('请输入 SecretId');
    return;
  }
  if (!form.value.bucket) {
    toast.error('请输入 Bucket');
    return;
  }
  if (!form.value.region) {
    toast.error('请输入 Region');
    return;
  }

  isSaving.value = true;
  testResult.value = null;

  try {
    const updateData: Partial<CosConfig> = {
      secret_id: form.value.secret_id,
      bucket: form.value.bucket,
      region: form.value.region,
      custom_domain: form.value.custom_domain,
      path_prefix: form.value.path_prefix,
    };

    // 只有输入了新密钥才提交
    if (form.value.secret_key) {
      updateData.secret_key = form.value.secret_key;
    }

    const response = await systemApi.updateCosConfig(updateData);
    hasConfig.value = response.configured;
    envConfigured.value = response.env_configured || false;
    form.value.secret_key = ''; // 清空密钥输入框
    toast.success('COS 配置保存成功');
  } catch (err) {
    let message = '保存失败，请重试';
    if (err && typeof err === 'object' && 'message' in err) {
      message = (err as { message: string }).message;
    }
    toast.error(message);
  } finally {
    isSaving.value = false;
  }
};

const handleTest = async () => {
  isTesting.value = true;
  testResult.value = null;

  try {
    const result = await systemApi.testCosConfig();
    testResult.value = {
      success: true,
      message: `连接成功！存储桶存在：${result.bucket_exists ? '是' : '否'}，可用存储桶数量：${result.bucket_count}`,
    };
    toast.success('COS 连接测试成功');
  } catch (err) {
    let message = '连接测试失败';
    if (err && typeof err === 'object' && 'message' in err) {
      message = (err as { message: string }).message;
    }
    testResult.value = { success: false, message };
    toast.error('COS 连接测试失败');
  } finally {
    isTesting.value = false;
  }
};

onMounted(() => {
  loadConfig();
});
</script>

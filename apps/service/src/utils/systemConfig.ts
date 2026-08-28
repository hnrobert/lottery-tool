import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(__dirname, '../../config/system.json');

export interface CosConfig {
  secret_id: string;
  secret_key: string;
  bucket: string;
  region: string;
  custom_domain: string | null;
  path_prefix: string;
}

export interface MaskedCosConfig {
  secret_id: string;
  secret_key: string;
  bucket: string;
  region: string;
  custom_domain: string;
  path_prefix: string;
}

export function readConfig(): Record<string, unknown> {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return {};
    }
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error: any) {
    console.error('读取系统配置文件失败:', error.message);
    return {};
  }
}

export function writeConfig(config: Record<string, unknown>): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

/**
 * COS 配置仅从环境变量读取，不支持 system.json 配置
 * 密钥只放服务端，推荐使用子账号最小权限
 */
export function getCosConfig(): CosConfig | null {
  const secretId = process.env.COS_SECRET_ID;
  const secretKey = process.env.COS_SECRET_KEY;
  const bucket = process.env.COS_BUCKET;
  const region = process.env.COS_REGION;
  if (!secretId || !secretKey || !bucket || !region) {
    return null;
  }
  return {
    secret_id: secretId,
    secret_key: secretKey,
    bucket: bucket,
    region: region,
    custom_domain: process.env.COS_CUSTOM_DOMAIN || null,
    path_prefix: process.env.COS_PATH_PREFIX || '',
  };
}

export function getMaskedCosConfig(): MaskedCosConfig | null {
  const config = getCosConfig();
  if (!config) {
    return null;
  }
  return {
    secret_id: config.secret_id || '',
    secret_key: config.secret_key ? '********' : '',
    bucket: config.bucket || '',
    region: config.region || '',
    custom_domain: config.custom_domain || '',
    path_prefix: config.path_prefix || '',
  };
}

export function isCosConfigured(): boolean {
  return getCosConfig() !== null;
}

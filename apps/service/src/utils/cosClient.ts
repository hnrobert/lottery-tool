import { getCosConfig, CosConfig } from './systemConfig';

// cos-nodejs-sdk-v5 无官方 TypeScript 类型定义，使用 require 导入并声明为 any
const COS = require('cos-nodejs-sdk-v5');

let cosInstance: any = null;
let lastConfigKey: string | null = null;

function getConfigKey(config: CosConfig | null): string | null {
  if (!config) return null;
  return `${config.secret_id}|${config.secret_key}|${config.bucket}|${config.region}`;
}

function getClient(): any {
  const config = getCosConfig();
  if (!config) {
    return null;
  }

  const key = getConfigKey(config);
  if (cosInstance && lastConfigKey === key) {
    return cosInstance;
  }

  cosInstance = new COS({
    SecretId: config.secret_id,
    SecretKey: config.secret_key,
  });
  lastConfigKey = key;

  return cosInstance;
}

function buildObjectKey(activityId: number, recordId: number, prefix: string = ''): string {
  const timestamp = Date.now();
  const base = `lottery-signatures/${activityId}/${recordId}/${timestamp}.png`;
  if (prefix) {
    const trimmed = prefix.replace(/^\/+|\/+$/g, '');
    return trimmed ? `${trimmed}/${base}` : base;
  }
  return base;
}

async function putObject(key: string, body: Buffer, contentType: string = 'image/png'): Promise<any> {
  const cos = getClient();
  if (!cos) {
    throw new Error('COS 未配置');
  }

  const config = getCosConfig() as CosConfig;

  return new Promise((resolve, reject) => {
    cos.putObject({
      Bucket: config.bucket,
      Region: config.region,
      Key: key,
      Body: body,
      ContentType: contentType,
    }, (err: any, data: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

async function getSignedUrl(key: string, expires: number = 3600): Promise<string> {
  const cos = getClient();
  if (!cos) {
    throw new Error('COS 未配置');
  }

  const config = getCosConfig() as CosConfig;

  return new Promise((resolve, reject) => {
    cos.getObjectUrl({
      Bucket: config.bucket,
      Region: config.region,
      Key: key,
      Sign: true,
      Expires: expires,
    }, (err: any, data: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(data.Url);
      }
    });
  });
}

function buildPublicUrl(key: string): string | null {
  const config = getCosConfig();
  if (!config) return null;

  if (config.custom_domain) {
    const domain = config.custom_domain.replace(/\/+$/, '');
    return `${domain}/${key}`;
  }

  return `https://${config.bucket}.cos.${config.region}.myqcloud.com/${key}`;
}

async function testConnection(): Promise<Record<string, unknown>> {
  const cos = getClient();
  if (!cos) {
    throw new Error('COS 未配置');
  }

  const config = getCosConfig() as CosConfig;

  return new Promise((resolve, reject) => {
    cos.getService((err: any, data: any) => {
      if (err) {
        reject(err);
      } else {
        const buckets = data.Buckets || [];
        const bucketExists = buckets.some((b: any) => b.Name === config.bucket);
        resolve({
          success: true,
          bucket_exists: bucketExists,
          bucket_count: buckets.length,
        });
      }
    });
  });
}

export {
  getClient,
  buildObjectKey,
  putObject,
  getSignedUrl,
  buildPublicUrl,
  testConnection,
};

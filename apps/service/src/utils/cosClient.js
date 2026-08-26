const COS = require('cos-nodejs-sdk-v5');
const { getCosConfig } = require('./systemConfig');

let cosInstance = null;
let lastConfigKey = null;

function getConfigKey(config) {
  if (!config) return null;
  return `${config.secret_id}|${config.secret_key}|${config.bucket}|${config.region}`;
}

function getClient() {
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

function buildObjectKey(activityId, recordId, prefix = '') {
  const timestamp = Date.now();
  const base = `lottery-signatures/${activityId}/${recordId}/${timestamp}.png`;
  if (prefix) {
    const trimmed = prefix.replace(/^\/+|\/+$/g, '');
    return trimmed ? `${trimmed}/${base}` : base;
  }
  return base;
}

async function putObject(key, body, contentType = 'image/png') {
  const cos = getClient();
  if (!cos) {
    throw new Error('COS 未配置');
  }

  const config = getCosConfig();

  return new Promise((resolve, reject) => {
    cos.putObject({
      Bucket: config.bucket,
      Region: config.region,
      Key: key,
      Body: body,
      ContentType: contentType,
    }, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

async function getSignedUrl(key, expires = 3600) {
  const cos = getClient();
  if (!cos) {
    throw new Error('COS 未配置');
  }

  const config = getCosConfig();

  return new Promise((resolve, reject) => {
    cos.getObjectUrl({
      Bucket: config.bucket,
      Region: config.region,
      Key: key,
      Sign: true,
      Expires: expires,
    }, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data.Url);
      }
    });
  });
}

function buildPublicUrl(key) {
  const config = getCosConfig();
  if (!config) return null;

  if (config.custom_domain) {
    const domain = config.custom_domain.replace(/\/+$/, '');
    return `${domain}/${key}`;
  }

  return `https://${config.bucket}.cos.${config.region}.myqcloud.com/${key}`;
}

async function testConnection() {
  const cos = getClient();
  if (!cos) {
    throw new Error('COS 未配置');
  }

  const config = getCosConfig();

  return new Promise((resolve, reject) => {
    cos.getService((err, data) => {
      if (err) {
        reject(err);
      } else {
        const buckets = data.Buckets || [];
        const bucketExists = buckets.some(b => b.Name === config.bucket);
        resolve({
          success: true,
          bucket_exists: bucketExists,
          bucket_count: buckets.length,
        });
      }
    });
  });
}

module.exports = {
  getClient,
  buildObjectKey,
  putObject,
  getSignedUrl,
  buildPublicUrl,
  testConnection,
};

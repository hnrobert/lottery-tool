const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../../config/system.json');

function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return {};
    }
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('读取系统配置文件失败:', error.message);
    return {};
  }
}

function writeConfig(config) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

function getCosConfigFromEnv() {
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
    source: 'env',
  };
}

function getCosConfig() {
  const envConfig = getCosConfigFromEnv();
  if (envConfig) {
    return envConfig;
  }
  const config = readConfig();
  if (!config.cos || !config.cos.secret_id || !config.cos.secret_key || !config.cos.bucket || !config.cos.region) {
    return null;
  }
  return {
    secret_id: config.cos.secret_id,
    secret_key: config.cos.secret_key,
    bucket: config.cos.bucket,
    region: config.cos.region,
    custom_domain: config.cos.custom_domain || null,
    path_prefix: config.cos.path_prefix || '',
    source: 'file',
  };
}

function getMaskedCosConfig() {
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
    source: config.source || 'file',
  };
}

function updateCosConfig(updates) {
  const config = readConfig();
  if (!config.cos) {
    config.cos = {};
  }
  if (updates.secret_id !== undefined) config.cos.secret_id = updates.secret_id;
  if (updates.secret_key !== undefined && updates.secret_key !== '') {
    config.cos.secret_key = updates.secret_key;
  }
  if (updates.bucket !== undefined) config.cos.bucket = updates.bucket;
  if (updates.region !== undefined) config.cos.region = updates.region;
  if (updates.custom_domain !== undefined) config.cos.custom_domain = updates.custom_domain;
  if (updates.path_prefix !== undefined) config.cos.path_prefix = updates.path_prefix;
  writeConfig(config);
  return getCosConfig();
}

function isCosConfigured() {
  return getCosConfig() !== null;
}

function isCosConfigFromEnv() {
  return getCosConfigFromEnv() !== null;
}

module.exports = {
  readConfig,
  writeConfig,
  getCosConfig,
  getCosConfigFromEnv,
  getMaskedCosConfig,
  updateCosConfig,
  isCosConfigured,
  isCosConfigFromEnv,
};

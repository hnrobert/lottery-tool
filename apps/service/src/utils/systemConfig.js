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

/**
 * COS 配置仅从环境变量读取，不支持 system.json 配置
 * 密钥只放服务端，推荐使用子账号最小权限
 */
function getCosConfig() {
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
  };
}

function isCosConfigured() {
  return getCosConfig() !== null;
}

module.exports = {
  readConfig,
  writeConfig,
  getCosConfig,
  getMaskedCosConfig,
  isCosConfigured,
};

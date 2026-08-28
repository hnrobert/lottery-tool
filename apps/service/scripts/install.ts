import inquirer from 'inquirer';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

console.log('\n=== 抽奖系统安装向导 ===\n');

// 本脚本经 tsup 构建为 scripts/dist/install.js，向上两级回到服务根目录
const SERVICE_ROOT = path.resolve(import.meta.dirname, '../..');

// 安装向导收集的配置
interface InstallConfig {
  dbHost: string;
  dbPort: string;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  adminUsername: string;
  adminEmail: string;
  adminPassword: string;
  confirmPassword: string;
  jwtSecret: string;
  serverPort: string;
}

const questions = [
  {
    type: 'input',
    name: 'dbHost',
    message: '请输入数据库主机地址:',
    default: 'localhost'
  },
  {
    type: 'input',
    name: 'dbPort',
    message: '请输入数据库端口:',
    default: '5432',
    validate: (value: string) => {
      const port = parseInt(value);
      return (port > 0 && port < 65536) || '请输入有效的端口号';
    }
  },
  {
    type: 'input',
    name: 'dbUser',
    message: '请输入数据库用户名:',
    default: 'postgres'
  },
  {
    type: 'password',
    name: 'dbPassword',
    message: '请输入数据库密码:'
  },
  {
    type: 'input',
    name: 'dbName',
    message: '请输入数据库名称:',
    default: 'lottery_system'
  },
  {
    type: 'input',
    name: 'adminUsername',
    message: '请输入超级管理员用户名:',
    default: 'admin',
    validate: (value: string) => {
      return value.length >= 3 || '用户名至少3个字符';
    }
  },
  {
    type: 'input',
    name: 'adminEmail',
    message: '请输入超级管理员邮箱:',
    validate: (value: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value) || '请输入有效的邮箱地址';
    }
  },
  {
    type: 'password',
    name: 'adminPassword',
    message: '请输入超级管理员密码:',
    validate: (value: string) => {
      return value.length >= 6 || '密码至少6个字符';
    }
  },
  {
    type: 'password',
    name: 'confirmPassword',
    message: '请确认超级管理员密码:'
  },
  {
    type: 'input',
    name: 'jwtSecret',
    message: '请输入JWT密钥 (留空自动生成):',
    default: ''
  },
  {
    type: 'input',
    name: 'serverPort',
    message: '请输入服务器端口:',
    default: '3000',
    validate: (value: string) => {
      const port = parseInt(value);
      return (port > 0 && port < 65536) || '请输入有效的端口号';
    }
  }
];

// 连接到 PostgreSQL 维护库（postgres）执行建库语句
const createDatabase = async (config: InstallConfig): Promise<void> => {
  console.log('\n正在创建数据库...');

  if (!/^[A-Za-z0-9_]+$/.test(config.dbName)) {
    throw new Error('数据库名称只能包含字母、数字和下划线');
  }

  const client = new Client({
    host: config.dbHost,
    port: Number(config.dbPort),
    user: config.dbUser,
    password: config.dbPassword,
    database: 'postgres'
  });
  await client.connect();

  try {
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      config.dbName
    ]);
    if (exists.rowCount === 0) {
      await client.query(`CREATE DATABASE "${config.dbName}"`);
      console.log(`数据库 ${config.dbName} 创建成功`);
    } else {
      console.log(`数据库 ${config.dbName} 已存在，跳过创建`);
    }
  } finally {
    await client.end();
  }
};

// 通过迁移建表并创建超级管理员
const createSuperAdmin = async (config: InstallConfig): Promise<void> => {
  console.log('\n正在应用数据库迁移...');

  // 在导入 DataSource 模块前注入连接信息（模块加载时读取环境变量）
  process.env.DB_HOST = config.dbHost;
  process.env.DB_PORT = config.dbPort;
  process.env.DB_USER = config.dbUser;
  process.env.DB_PASSWORD = config.dbPassword;
  process.env.DB_NAME = config.dbName;

  const { initDataSource, closeDataSource, AppDataSource } = await import('../src/utils/database');
  const { User } = await import('../src/entities');

  try {
    await initDataSource();

    console.log('正在创建超级管理员账户...');
    const passwordHash = await bcrypt.hash(config.adminPassword, 12);

    await AppDataSource.getRepository(User).insert({
      username: config.adminUsername,
      password_hash: passwordHash,
      email: config.adminEmail,
      role: 'super_admin',
      status: 'active'
    });

    console.log(`超级管理员账户 ${config.adminUsername} 创建成功`);
  } finally {
    await closeDataSource();
  }
};

const createConfigFiles = (config: InstallConfig): void => {
  console.log('\n正在创建配置文件...');

  // 创建目录
  const configDir = path.join(SERVICE_ROOT, 'config');
  const logsDir = path.join(SERVICE_ROOT, 'logs');

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // 生成JWT密钥
  const jwtSecret = config.jwtSecret || crypto.randomBytes(32).toString('hex');

  // 创建.env文件
  const envContent = `# 服务器配置
PORT=${config.serverPort}
NODE_ENV=production

# 数据库配置（PostgreSQL）
DB_HOST=${config.dbHost}
DB_PORT=${config.dbPort}
DB_NAME=${config.dbName}
DB_USER=${config.dbUser}
DB_PASSWORD=${config.dbPassword}

# JWT配置
JWT_SECRET=${jwtSecret}
JWT_EXPIRES_IN=24h

# 文件上传配置
UPLOAD_MAX_SIZE=5242880

# 日志配置
LOG_LEVEL=info
LOG_FILE=logs/app.log

# 系统配置
SYSTEM_INSTALLED=true
`;

  fs.writeFileSync(path.join(SERVICE_ROOT, '.env'), envContent);

  // 创建系统配置文件
  const systemConfig = {
    installed: true,
    installTime: new Date().toISOString(),
    version: '1.0.0',
    database: {
      type: 'postgres',
      host: config.dbHost,
      port: config.dbPort,
      name: config.dbName
    },
    superAdmin: {
      username: config.adminUsername,
      email: config.adminEmail
    }
  };

  fs.writeFileSync(
    path.join(configDir, 'system.json'),
    JSON.stringify(systemConfig, null, 2)
  );

  console.log('配置文件创建成功');
};

const install = async (): Promise<void> => {
  try {
    const answers = (await inquirer.prompt(questions)) as InstallConfig;

    // 验证密码确认
    if (answers.adminPassword !== answers.confirmPassword) {
      console.log('\n❌ 密码确认不匹配，请重新运行安装脚本');
      process.exit(1);
    }

    console.log('\n开始安装抽奖系统...\n');

    // 测试数据库连接（连维护库）
    console.log('正在测试数据库连接...');
    try {
      const testClient = new Client({
        host: answers.dbHost,
        port: Number(answers.dbPort),
        user: answers.dbUser,
        password: answers.dbPassword,
        database: 'postgres'
      });
      await testClient.connect();
      await testClient.end();
      console.log('数据库连接测试成功');
    } catch (error: any) {
      console.log(`❌ 数据库连接失败: ${error.message}`);
      process.exit(1);
    }

    // 执行安装步骤：建库 → 迁移建表 + 超管 → 配置文件
    await createDatabase(answers);
    await createSuperAdmin(answers);
    createConfigFiles(answers);

    console.log('\n🎉 抽奖系统安装完成！\n');
    console.log('现在可以启动系统：');
    console.log('  pnpm start    # 生产模式启动');
    console.log('  pnpm dev      # 开发模式启动');
    console.log('\n超级管理员账户信息：');
    console.log(`  用户名: ${answers.adminUsername}`);
    console.log(`  邮箱: ${answers.adminEmail}`);
    console.log(`\n访问地址: http://localhost:${answers.serverPort}`);
    console.log('=========================\n');
  } catch (error: any) {
    console.error('\n❌ 安装过程中发生错误:', error.message);
    process.exit(1);
  }
};

// 检查是否已安装
const configPath = path.join(SERVICE_ROOT, 'config', 'system.json');
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (config.installed) {
    console.log('\n⚠️  系统已经安装过了！');
    console.log('如需重新安装，请删除 config/system.json 文件后重试\n');
    process.exit(0);
  }
}

// 开始安装
install();

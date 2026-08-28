import inquirer from 'inquirer';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

console.log('\n=== 抽奖系统安装向导 ===\n');

// 编译产物位于 dist/scripts，向上两级回到服务根目录
const SERVICE_ROOT = path.resolve(__dirname, '../..');

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
    default: '3306',
    validate: (value: string) => {
      const port = parseInt(value);
      return (port > 0 && port < 65536) || '请输入有效的端口号';
    }
  },
  {
    type: 'input',
    name: 'dbUser',
    message: '请输入数据库用户名:',
    default: 'root'
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

const createDatabase = async (config: InstallConfig): Promise<void> => {
  console.log('\n正在创建数据库...');

  // 先连接MySQL（不指定数据库）
  const connection = await mysql.createConnection({
    host: config.dbHost,
    port: Number(config.dbPort),
    user: config.dbUser,
    password: config.dbPassword
  });

  // 创建数据库
  await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${config.dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  console.log(`数据库 ${config.dbName} 创建成功`);

  await connection.end();
};

const createTables = async (config: InstallConfig): Promise<void> => {
  console.log('\n正在创建数据表...');

  const connection = await mysql.createConnection({
    host: config.dbHost,
    port: Number(config.dbPort),
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName
  });

  // 创建用户表
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      email VARCHAR(100),
      role ENUM('super_admin', 'admin') DEFAULT 'admin',
      status ENUM('active', 'inactive') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 创建活动表
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS activities (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      lottery_mode ENUM('offline', 'online') NOT NULL,
      start_time DATETIME,
      end_time DATETIME,
      status ENUM('draft', 'active', 'ended') DEFAULT 'draft',
      settings JSON COMMENT '活动设置：max_lottery_codes, lottery_code_format, allow_duplicate_phone等',
      webhook_id VARCHAR(50) UNIQUE COMMENT 'Webhook唯一标识',
      webhook_token VARCHAR(255) COMMENT 'Webhook访问token',
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 创建奖品表
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS prizes (
      id INT PRIMARY KEY AUTO_INCREMENT,
      activity_id INT NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      total_quantity INT NOT NULL DEFAULT 0,
      remaining_quantity INT NOT NULL DEFAULT 0,
      probability DECIMAL(5,4) NOT NULL,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 创建抽奖码表
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS lottery_codes (
      id INT PRIMARY KEY AUTO_INCREMENT,
      activity_id INT NOT NULL,
      code VARCHAR(50) NOT NULL,
      status ENUM('unused', 'used') DEFAULT 'unused',
      participant_info JSON COMMENT '参与者信息：name, phone, email等',
      used_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_activity_code (activity_id, code),
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 创建抽奖记录表
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS lottery_records (
      id INT PRIMARY KEY AUTO_INCREMENT,
      activity_id INT NOT NULL,
      lottery_code_id INT NOT NULL,
      prize_id INT NULL,
      is_winner BOOLEAN DEFAULT FALSE,
      operator_id INT NULL COMMENT '线下抽奖时的操作员ID',
      ip_address VARCHAR(45),
      user_agent TEXT,
      signature_key VARCHAR(512) COMMENT '签字图片在COS中的对象键',
      signature_url TEXT COMMENT '签字图片访问URL',
      signed_at DATETIME COMMENT '签字时间',
      signature_status ENUM('unsigned', 'signed') DEFAULT 'unsigned' COMMENT '签字状态',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
      FOREIGN KEY (lottery_code_id) REFERENCES lottery_codes(id) ON DELETE CASCADE,
      FOREIGN KEY (prize_id) REFERENCES prizes(id) ON DELETE SET NULL,
      FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 创建操作日志表
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT,
      operation_type VARCHAR(50) NOT NULL,
      operation_detail TEXT,
      target_type VARCHAR(50),
      target_id INT,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('数据表创建成功');
  await connection.end();
};

const createSuperAdmin = async (config: InstallConfig): Promise<void> => {
  console.log('\n正在创建超级管理员账户...');

  const connection = await mysql.createConnection({
    host: config.dbHost,
    port: Number(config.dbPort),
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName
  });

  const passwordHash = await bcrypt.hash(config.adminPassword, 12);

  await connection.execute(
    'INSERT INTO users (username, password_hash, email, role, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
    [config.adminUsername, passwordHash, config.adminEmail, 'super_admin']
  );

  console.log(`超级管理员账户 ${config.adminUsername} 创建成功`);
  await connection.end();
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

# 数据库配置
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

    // 测试数据库连接
    console.log('正在测试数据库连接...');
    try {
      const testConnection = await mysql.createConnection({
        host: answers.dbHost,
        port: Number(answers.dbPort),
        user: answers.dbUser,
        password: answers.dbPassword
      });
      await testConnection.end();
      console.log('数据库连接测试成功');
    } catch (error: any) {
      console.log(`❌ 数据库连接失败: ${error.message}`);
      process.exit(1);
    }

    // 执行安装步骤
    await createDatabase(answers);
    await createTables(answers);
    await createSuperAdmin(answers);
    createConfigFiles(answers);

    console.log('\n🎉 抽奖系统安装完成！\n');
    console.log('现在可以启动系统：');
    console.log('  npm start     # 生产模式启动');
    console.log('  npm run dev   # 开发模式启动');
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

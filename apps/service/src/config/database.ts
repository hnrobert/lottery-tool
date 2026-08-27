import { Sequelize } from 'sequelize';
import logger from '../utils/logger';

// 数据库连接配置
export const sequelize = new Sequelize(
  process.env.DB_NAME || 'lottery_system',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    logging: (sql: string) => {
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`SQL: ${sql}`);
      }
    },
    timezone: '+08:00', // 设置时区为中国标准时间
    dialectOptions: {
      charset: 'utf8mb4',
      dateStrings: true,
      typeCast: true
    },
    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      timestamps: true,
      paranoid: false,
      underscored: false,
      freezeTableName: true
    }
  }
);

// 测试数据库连接
export async function testConnection(): Promise<boolean> {
  try {
    await sequelize.authenticate();
    logger.info('数据库连接已建立');
    return true;
  } catch (error) {
    logger.error('无法连接到数据库:', error);
    return false;
  }
}

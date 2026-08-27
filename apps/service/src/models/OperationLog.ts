import { DataTypes, Model, Optional, Op } from 'sequelize';
import { sequelize } from '../config/database';

export interface OperationLogAttributes {
  id: number;
  user_id: number | null;
  operation_type: string;
  operation_detail: string | null;
  target_type: string | null;
  target_id: number | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

interface OperationLogCreationAttributes extends Optional<OperationLogAttributes, 'id' | 'created_at'> {}

class OperationLog extends Model<OperationLogAttributes, OperationLogCreationAttributes> implements OperationLogAttributes {
  public id!: number;
  public user_id!: number | null;
  public operation_type!: string;
  public operation_detail!: string | null;
  public target_type!: string | null;
  public target_id!: number | null;
  public ip_address!: string | null;
  public user_agent!: string | null;
  public created_at!: Date;

  // 操作类型常量
  public static OPERATION_TYPES: Record<string, string> = {
    // 认证相关
    USER_LOGIN: 'USER_LOGIN',
    USER_LOGOUT: 'USER_LOGOUT',
    USER_REGISTER: 'USER_REGISTER',
    PASSWORD_CHANGE: 'PASSWORD_CHANGE',

    // 活动管理
    CREATE_ACTIVITY: 'CREATE_ACTIVITY',
    UPDATE_ACTIVITY: 'UPDATE_ACTIVITY',
    DELETE_ACTIVITY: 'DELETE_ACTIVITY',
    ACTIVATE_ACTIVITY: 'ACTIVATE_ACTIVITY',
    END_ACTIVITY: 'END_ACTIVITY',

    // 奖品管理
    CREATE_PRIZE: 'CREATE_PRIZE',
    UPDATE_PRIZE: 'UPDATE_PRIZE',
    DELETE_PRIZE: 'DELETE_PRIZE',

    // 抽奖码管理
    CREATE_LOTTERY_CODE: 'CREATE_LOTTERY_CODE',
    BATCH_CREATE_LOTTERY_CODE: 'BATCH_CREATE_LOTTERY_CODE',
    IMPORT_LOTTERY_CODE: 'IMPORT_LOTTERY_CODE',
    UPDATE_LOTTERY_CODE: 'UPDATE_LOTTERY_CODE',
    DELETE_LOTTERY_CODE: 'DELETE_LOTTERY_CODE',
    INVALIDATE_LOTTERY_CODE: 'INVALIDATE_LOTTERY_CODE',
    BATCH_INVALIDATE_LOTTERY_CODE: 'BATCH_INVALIDATE_LOTTERY_CODE',

    // 抽奖操作
    ONLINE_LOTTERY: 'ONLINE_LOTTERY',
    OFFLINE_LOTTERY: 'OFFLINE_LOTTERY',

    // 系统管理
    CREATE_USER: 'CREATE_USER',
    UPDATE_USER: 'UPDATE_USER',
    DELETE_USER: 'DELETE_USER',
    SYSTEM_BACKUP: 'SYSTEM_BACKUP',
    SYSTEM_RESTORE: 'SYSTEM_RESTORE',

    // Webhook操作
    WEBHOOK_CREATE_LOTTERY_CODE: 'WEBHOOK_CREATE_LOTTERY_CODE'
  };

  // 类方法：记录操作日志
  public static async log(data: {
    user_id: number | null;
    operation_type: string;
    operation_detail: string | null;
    target_type?: string | null;
    target_id?: number | null;
    ip_address?: string | null;
    user_agent?: string | null;
  }): Promise<OperationLog> {
    const {
      user_id,
      operation_type,
      operation_detail,
      target_type = null,
      target_id = null,
      ip_address = null,
      user_agent = null
    } = data;

    return await this.create({
      user_id,
      operation_type,
      operation_detail,
      target_type,
      target_id,
      ip_address,
      user_agent
    });
  }

  // 类方法：记录用户登录
  public static async logUserLogin(userId: number, ipAddress: string, userAgent: string): Promise<OperationLog> {
    return await this.log({
      user_id: userId,
      operation_type: this.OPERATION_TYPES.USER_LOGIN,
      operation_detail: '用户登录',
      ip_address: ipAddress,
      user_agent: userAgent
    });
  }

  // 类方法：记录用户登出
  public static async logUserLogout(userId: number, ipAddress: string, userAgent: string): Promise<OperationLog> {
    return await this.log({
      user_id: userId,
      operation_type: this.OPERATION_TYPES.USER_LOGOUT,
      operation_detail: '用户登出',
      ip_address: ipAddress,
      user_agent: userAgent
    });
  }

  // 类方法：记录活动操作
  public static async logActivityOperation(
    operationType: string,
    userId: number,
    activityId: number,
    activityName: string,
    ipAddress: string,
    userAgent: string
  ): Promise<OperationLog> {
    const operationDetails: Record<string, string> = {
      [this.OPERATION_TYPES.CREATE_ACTIVITY]: `创建活动: ${activityName}`,
      [this.OPERATION_TYPES.UPDATE_ACTIVITY]: `更新活动: ${activityName}`,
      [this.OPERATION_TYPES.DELETE_ACTIVITY]: `删除活动: ${activityName}`,
      [this.OPERATION_TYPES.ACTIVATE_ACTIVITY]: `激活活动: ${activityName}`,
      [this.OPERATION_TYPES.END_ACTIVITY]: `结束活动: ${activityName}`
    };

    return await this.log({
      user_id: userId,
      operation_type: operationType,
      operation_detail: operationDetails[operationType],
      target_type: 'ACTIVITY',
      target_id: activityId,
      ip_address: ipAddress,
      user_agent: userAgent
    });
  }

  // 类方法：记录抽奖操作
  public static async logLotteryOperation(
    operationType: string,
    userId: number,
    activityId: number,
    lotteryCodeId: number,
    prizeName: string | null,
    ipAddress: string,
    userAgent: string
  ): Promise<OperationLog> {
    const isWinner = !!prizeName;
    const detail = isWinner
      ? `${operationType === this.OPERATION_TYPES.ONLINE_LOTTERY ? '线上' : '线下'}抽奖中奖: ${prizeName}`
      : `${operationType === this.OPERATION_TYPES.ONLINE_LOTTERY ? '线上' : '线下'}抽奖未中奖`;

    return await this.log({
      user_id: userId,
      operation_type: operationType,
      operation_detail: detail,
      target_type: 'LOTTERY_RECORD',
      target_id: lotteryCodeId,
      ip_address: ipAddress,
      user_agent: userAgent
    });
  }

  // 类方法：获取操作日志列表
  public static async getList(
    options: {
      page?: number;
      limit?: number;
      user_id?: number;
      operation_type?: string;
      target_type?: string;
      start_date?: string;
      end_date?: string;
    } = {}
  ): Promise<Record<string, unknown>> {
    const {
      page = 1,
      limit = 20,
      user_id,
      operation_type,
      target_type,
      start_date,
      end_date
    } = options;

    const offset = (page - 1) * limit;
    const whereClause: Record<string, unknown> = {};

    if (user_id) {
      whereClause.user_id = user_id;
    }

    if (operation_type) {
      whereClause.operation_type = operation_type;
    }

    if (target_type) {
      whereClause.target_type = target_type;
    }

    if (start_date) {
      whereClause.created_at = { [Op.gte]: new Date(start_date) };
    }

    if (end_date) {
      if (whereClause.created_at) {
        (whereClause.created_at as Record<string, unknown>)[Op.lte as any] = new Date(end_date);
      } else {
        whereClause.created_at = { [Op.lte]: new Date(end_date) };
      }
    }

    const { count, rows } = await this.findAndCountAll({
      where: whereClause as any,
      include: [
        {
          model: require('./User').default,
          as: 'user',
          required: false,
          attributes: ['id', 'username']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(String(limit)),
      offset: parseInt(String(offset))
    });

    return {
      logs: rows,
      pagination: {
        total: count,
        page: parseInt(String(page)),
        limit: parseInt(String(limit)),
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  // 类方法：获取操作类型统计
  public static async getOperationTypeStatistics(): Promise<unknown[]> {
    const stats = await this.findAll({
      attributes: [
        'operation_type',
        [sequelize.fn('COUNT', sequelize.col('operation_type')), 'count']
      ],
      group: ['operation_type'],
      order: [[sequelize.fn('COUNT', sequelize.col('operation_type')), 'DESC']],
      raw: true
    });

    return stats;
  }

  // 类方法：清理指定天数前的日志
  public static async cleanup(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const deletedCount = await this.destroy({
      where: {
        created_at: { [Op.lt]: cutoffDate }
      }
    });

    return deletedCount;
  }

  // 类方法：获取用户操作统计
  public static async getUserStatistics(userId: number, days: number = 30): Promise<unknown[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await this.findAll({
      where: {
        user_id: userId,
        created_at: { [Op.gte]: startDate }
      },
      attributes: [
        'operation_type',
        [sequelize.fn('COUNT', sequelize.col('operation_type')), 'count'],
        [sequelize.fn('DATE', sequelize.col('created_at')), 'date']
      ],
      group: ['operation_type', sequelize.fn('DATE', sequelize.col('created_at'))],
      order: [['date', 'ASC']],
      raw: true
    });

    return stats;
  }

  // 设置关联关系
  public static associate(models: Record<string, any>): void {
    OperationLog.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  }
}

OperationLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    operation_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'operation_type'
    },
    operation_detail: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'operation_detail'
    },
    target_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'target_type'
    },
    target_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'target_id'
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'ip_address'
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'user_agent'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    }
  },
  {
    sequelize,
    tableName: 'operation_logs',
    timestamps: false
  }
);

export default OperationLog;

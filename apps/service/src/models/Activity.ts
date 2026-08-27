import { DataTypes, Model, Optional, Op } from 'sequelize';
import { sequelize } from '../config/database';
import crypto from 'crypto';

// 活动设置类型
export interface ActivitySettings {
  max_lottery_codes?: number;
  lottery_code_format?: string;
  allow_duplicate_phone?: boolean;
  lottery_strategy?: 'probability' | 'guaranteed';
  [key: string]: unknown;
}

// 活动属性
export interface ActivityAttributes {
  id: number;
  name: string;
  description: string | null;
  lottery_mode: 'offline' | 'online';
  start_time: Date | null;
  end_time: Date | null;
  status: 'draft' | 'active' | 'ended';
  settings: ActivitySettings;
  webhook_id: string | null;
  webhook_token: string | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

interface ActivityCreationAttributes extends Optional<ActivityAttributes, 'id' | 'created_at' | 'updated_at'> {}

class Activity extends Model<ActivityAttributes, ActivityCreationAttributes> implements ActivityAttributes {
  public id!: number;
  public name!: string;
  public description!: string | null;
  public lottery_mode!: 'offline' | 'online';
  public start_time!: Date | null;
  public end_time!: Date | null;
  public status!: 'draft' | 'active' | 'ended';
  public settings!: ActivitySettings;
  public webhook_id!: string | null;
  public webhook_token!: string | null;
  public created_by!: number | null;
  public created_at!: Date;
  public updated_at!: Date;

  // 实例方法：检查活动是否可以开始抽奖
  public canStartLottery(): { canStart: boolean; reason?: string } {
    const now = new Date();

    if (this.status !== 'active') {
      return { canStart: false, reason: '活动未激活' };
    }

    if (this.start_time && now < this.start_time) {
      return { canStart: false, reason: '活动未开始' };
    }

    if (this.end_time && now > this.end_time) {
      return { canStart: false, reason: '活动已结束' };
    }

    return { canStart: true };
  }

  // 实例方法：获取活动统计信息
  public async getStatistics(): Promise<Record<string, unknown>> {
    const LotteryCode = require('./LotteryCode').default;
    const LotteryRecord = require('./LotteryRecord').default;
    const Prize = require('./Prize').default;

    const [totalLotteryCodes, usedLotteryCodes, totalRecords, totalWinners, prizes] = await Promise.all([
      LotteryCode.count({ where: { activity_id: this.id } }),
      LotteryCode.count({ where: { activity_id: this.id, status: 'used' } }),
      LotteryRecord.count({ where: { activity_id: this.id } }),
      LotteryRecord.count({ where: { activity_id: this.id, is_winner: true } }),
      Prize.findAll({ where: { activity_id: this.id } })
    ]);

    const remainingLotteryCodes = totalLotteryCodes - usedLotteryCodes;
    const winRate = totalRecords > 0 ? ((totalWinners / totalRecords) * 100).toFixed(2) : '0.00';

    const prizeStatistics = prizes.map((prize: any) => ({
      id: prize.id,
      name: prize.name,
      total_quantity: prize.total_quantity,
      remaining_quantity: prize.remaining_quantity,
      awarded_count: prize.total_quantity - prize.remaining_quantity,
      award_rate: prize.total_quantity > 0
        ? (((prize.total_quantity - prize.remaining_quantity) / prize.total_quantity) * 100).toFixed(2)
        : '0.00'
    }));

    return {
      lottery_codes_count: totalLotteryCodes,
      remaining_lottery_codes: remainingLotteryCodes,
      used_lottery_codes: usedLotteryCodes,
      total_lottery_codes: totalLotteryCodes,
      total_lottery_records: totalRecords,
      total_winners: totalWinners,
      win_rate: winRate,
      prize_statistics: prizeStatistics
    };
  }

  // 实例方法：重新生成Webhook token
  public async regenerateWebhookToken(): Promise<string | null> {
    this.webhook_token = crypto.randomBytes(32).toString('hex');
    await this.save();
    return this.webhook_token;
  }

  // 类方法：通过webhook_id查找活动
  public static async findByWebhookId(webhookId: string): Promise<Activity | null> {
    return await this.findOne({
      where: { webhook_id: webhookId }
    });
  }

  // 类方法：获取用户创建的活动
  public static async findByCreator(
    userId: number,
    options: { page?: number; limit?: number; search?: string; status?: string } = {}
  ): Promise<Record<string, unknown>> {
    const { page = 1, limit = 10, search, status } = options;
    const offset = (page - 1) * limit;

    const whereClause: Record<string, unknown> = { created_by: userId };

    if (search) {
      whereClause[Op.or as any] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    if (status) {
      whereClause.status = status;
    }

    const { count, rows } = await this.findAndCountAll({
      where: whereClause as any,
      order: [['created_at', 'DESC']],
      limit: parseInt(String(limit)),
      offset: parseInt(String(offset))
    });

    // 为每个活动添加抽奖码统计信息
    const LotteryCode = require('./LotteryCode').default;
    const activitiesWithStats = await Promise.all(
      rows.map(async (activity: Activity) => {
        const activityData = activity.toJSON() as unknown as Record<string, unknown>;

        const [totalLotteryCodes, usedLotteryCodes] = await Promise.all([
          LotteryCode.count({ where: { activity_id: activity.id } }),
          LotteryCode.count({ where: { activity_id: activity.id, status: 'used' } })
        ]);

        const remainingLotteryCodes = totalLotteryCodes - usedLotteryCodes;

        activityData.lottery_codes_count = totalLotteryCodes;
        activityData.remaining_lottery_codes = remainingLotteryCodes;
        activityData.used_lottery_codes = usedLotteryCodes;

        return activityData;
      })
    );

    return {
      activities: activitiesWithStats,
      pagination: {
        total: count,
        page: parseInt(String(page)),
        limit: parseInt(String(limit)),
        totalPages: Math.ceil(count / limit)
      }
    };
  }
}

Activity.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [1, 100],
        notEmpty: true
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    lottery_mode: {
      type: DataTypes.ENUM('offline', 'online'),
      allowNull: false,
      field: 'lottery_mode'
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'start_time'
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'end_time'
    },
    status: {
      type: DataTypes.ENUM('draft', 'active', 'ended'),
      allowNull: false,
      defaultValue: 'draft'
    },
    settings: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
      comment: '活动设置：max_lottery_codes, lottery_code_format, allow_duplicate_phone等'
    },
    webhook_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
      field: 'webhook_id',
      comment: 'Webhook唯一标识'
    },
    webhook_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'webhook_token',
      comment: 'Webhook访问token'
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'created_by',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at'
    }
  },
  {
    sequelize,
    tableName: 'activities',
    timestamps: false,
    hooks: {
      beforeCreate: (activity: Activity) => {
        // 自动生成webhook相关信息
        if (!activity.webhook_id) {
          activity.webhook_id = crypto.randomBytes(16).toString('hex');
        }
        if (!activity.webhook_token) {
          activity.webhook_token = crypto.randomBytes(32).toString('hex');
        }

        // 设置默认settings
        if (!activity.settings || Object.keys(activity.settings).length === 0) {
          activity.settings = {
            max_lottery_codes: 1000,
            lottery_code_format: '8_digit_number',
            allow_duplicate_phone: false,
            lottery_strategy: 'probability' // 抽奖策略：'probability'(概率模式) 或 'guaranteed'(100%中奖模式)
          };
        }

        // 确保抽奖策略配置存在
        if (!activity.settings.lottery_strategy) {
          activity.settings.lottery_strategy = 'probability';
        }
      },
      beforeUpdate: (activity: Activity) => {
        activity.updated_at = new Date();
      }
    }
  }
);

export default Activity;

import { DataTypes, Model, Optional, Op, Transaction } from 'sequelize';
import { sequelize } from '../config/database';

export interface LotteryRecordAttributes {
  id: number;
  activity_id: number;
  lottery_code_id: number;
  prize_id: number | null;
  is_winner: boolean;
  operator_id: number | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

interface LotteryRecordCreationAttributes extends Optional<LotteryRecordAttributes, 'id' | 'created_at'> {}

class LotteryRecord extends Model<LotteryRecordAttributes, LotteryRecordCreationAttributes> implements LotteryRecordAttributes {
  public id!: number;
  public activity_id!: number;
  public lottery_code_id!: number;
  public prize_id!: number | null;
  public is_winner!: boolean;
  public operator_id!: number | null;
  public ip_address!: string | null;
  public user_agent!: string | null;
  public created_at!: Date;

  // 实例方法：检查是否中奖
  public isWinning(): boolean {
    return !!(this.is_winner && this.prize_id);
  }

  // 实例方法：获取抽奖类型
  public getLotteryType(): 'offline' | 'online' {
    return this.operator_id ? 'offline' : 'online';
  }

  // 类方法：创建抽奖记录
  public static async createRecord(
    data: {
      activity_id: number;
      lottery_code_id: number;
      prize_id?: number | null;
      is_winner?: boolean;
      operator_id?: number | null;
      ip_address?: string | null;
      user_agent?: string | null;
    },
    options: { transaction?: Transaction } = {}
  ): Promise<LotteryRecord> {
    const {
      activity_id,
      lottery_code_id,
      prize_id = null,
      is_winner = false,
      operator_id = null,
      ip_address = null,
      user_agent = null
    } = data;

    return await this.create(
      {
        activity_id,
        lottery_code_id,
        prize_id,
        is_winner,
        operator_id,
        ip_address,
        user_agent
      },
      { transaction: options.transaction }
    );
  }

  // 类方法：获取活动的抽奖记录
  public static async findByActivity(
    activityId: number,
    options: {
      page?: number;
      limit?: number;
      winner_only?: boolean;
      participant_name?: string;
      lottery_code?: string;
      keyword?: string;
      start_date?: string;
      end_date?: string;
    } = {}
  ): Promise<Record<string, unknown>> {
    const {
      page = 1,
      limit = 20,
      winner_only = false,
      participant_name,
      lottery_code,
      keyword,
      start_date,
      end_date
    } = options;

    const offset = (page - 1) * limit;
    const whereClause: Record<string, unknown> = { activity_id: activityId };

    if (winner_only) {
      whereClause.is_winner = true;
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

    const include: any[] = [
      {
        model: require('./LotteryCode').default,
        as: 'lotteryCode',
        required: true
      },
      {
        model: require('./Prize').default,
        as: 'prize',
        required: false
      },
      {
        model: require('./Activity').default,
        as: 'activity',
        required: true
      },
      {
        model: require('./User').default,
        as: 'operator',
        required: false
      }
    ];

    // 如果有参与者姓名搜索，添加条件
    if (participant_name) {
      include[0].where = sequelize.literal(
        `JSON_EXTRACT(participant_info, '$.name') LIKE '%${participant_name}%'`
      );
    }

    // 如果有抽奖码搜索，添加条件
    if (lottery_code) {
      include[0].where = {
        ...(include[0].where || {}),
        code: { [Op.like]: `%${lottery_code}%` }
      };
    }

    // 如果有关键词搜索，添加条件
    if (keyword) {
      include[0].where = {
        ...(include[0].where || {}),
        [Op.or]: [
          { code: { [Op.like]: `%${keyword}%` } },
          sequelize.literal(`JSON_EXTRACT(participant_info, '$.name') LIKE '%${keyword}%'`),
          sequelize.literal(`JSON_EXTRACT(participant_info, '$.phone') LIKE '%${keyword}%'`),
          sequelize.literal(`JSON_EXTRACT(participant_info, '$.email') LIKE '%${keyword}%'`)
        ]
      };
    }

    const { count, rows } = await this.findAndCountAll({
      where: whereClause as any,
      include,
      order: [['created_at', 'DESC']],
      limit: parseInt(String(limit)),
      offset: parseInt(String(offset)),
      distinct: true
    });

    return {
      records: rows,
      pagination: {
        total: count,
        page: parseInt(String(page)),
        limit: parseInt(String(limit)),
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  // 类方法：获取管理员的抽奖记录
  public static async findByOperator(
    operatorId: number,
    options: { page?: number; limit?: number; activity_id?: number } = {}
  ): Promise<Record<string, unknown>> {
    const { page = 1, limit = 20, activity_id } = options;
    const offset = (page - 1) * limit;

    const whereClause: Record<string, unknown> = { operator_id: operatorId };

    if (activity_id) {
      whereClause.activity_id = activity_id;
    }

    const { count, rows } = await this.findAndCountAll({
      where: whereClause as any,
      include: [
        {
          model: require('./LotteryCode').default,
          as: 'lotteryCode',
          required: true
        },
        {
          model: require('./Prize').default,
          as: 'prize',
          required: false
        },
        {
          model: require('./Activity').default,
          as: 'activity',
          required: true
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(String(limit)),
      offset: parseInt(String(offset))
    });

    return {
      records: rows,
      pagination: {
        total: count,
        page: parseInt(String(page)),
        limit: parseInt(String(limit)),
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  // 类方法：获取中奖记录统计
  public static async getWinningStatistics(
    activityId: number,
    options: { start_date?: string; end_date?: string } = {}
  ): Promise<Record<string, unknown>> {
    const { start_date, end_date } = options;

    const whereClause: Record<string, unknown> = {
      activity_id: activityId,
      is_winner: true
    };

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

    // 按奖品分组统计
    const prizeStats = await this.findAll({
      where: whereClause as any,
      include: [
        {
          model: require('./Prize').default,
          as: 'prize',
          required: true
        }
      ],
      attributes: [
        'prize_id',
        [sequelize.fn('COUNT', sequelize.col('LotteryRecord.id')), 'count']
      ],
      group: ['prize_id', 'prize.id'],
      raw: false
    });

    // 按日期分组统计
    const dailyStats = await this.findAll({
      where: whereClause as any,
      attributes: [
        [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: [sequelize.fn('DATE', sequelize.col('created_at'))],
      order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
      raw: true
    });

    const totalWinners = await this.count({ where: whereClause as any });

    return {
      total_winners: totalWinners,
      prize_statistics: prizeStats,
      daily_statistics: dailyStats
    };
  }

  // 类方法：获取抽奖记录总数
  public static async getTotalRecords(activityId: number): Promise<number> {
    return await this.count({
      where: { activity_id: activityId }
    });
  }

  // 类方法：获取中奖记录总数
  public static async getTotalWinners(activityId: number): Promise<number> {
    return await this.count({
      where: {
        activity_id: activityId,
        is_winner: true
      }
    });
  }

  // 类方法：检查抽奖码是否已抽奖
  public static async hasDrawn(lotteryCodeId: number): Promise<boolean> {
    const record = await this.findOne({
      where: { lottery_code_id: lotteryCodeId }
    });

    return !!record;
  }
}

LotteryRecord.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    activity_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'activity_id',
      references: {
        model: 'activities',
        key: 'id'
      }
    },
    lottery_code_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'lottery_code_id',
      references: {
        model: 'lottery_codes',
        key: 'id'
      }
    },
    prize_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'prize_id',
      references: {
        model: 'prizes',
        key: 'id'
      }
    },
    is_winner: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_winner'
    },
    operator_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'operator_id',
      references: {
        model: 'users',
        key: 'id'
      },
      comment: '线下抽奖时的操作员ID'
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
    tableName: 'lottery_records',
    timestamps: false
  }
);

export default LotteryRecord;

import { DataTypes, Model, Optional, Op, Transaction } from 'sequelize';
import { sequelize } from '../config/database';

export interface ParticipantInfo {
  name?: string;
  phone?: string;
  email?: string;
  [key: string]: unknown;
}

export interface LotteryCodeAttributes {
  id: number;
  activity_id: number;
  code: string;
  status: 'unused' | 'used' | 'invalid';
  participant_info: ParticipantInfo | null;
  used_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface LotteryCodeCreationAttributes extends Optional<LotteryCodeAttributes, 'id' | 'created_at' | 'updated_at'> {}

class LotteryCode extends Model<LotteryCodeAttributes, LotteryCodeCreationAttributes> implements LotteryCodeAttributes {
  public id!: number;
  public activity_id!: number;
  public code!: string;
  public status!: 'unused' | 'used' | 'invalid';
  public participant_info!: ParticipantInfo | null;
  public used_at!: Date | null;
  public created_at!: Date;
  public updated_at!: Date;

  // 实例方法：检查是否已使用
  public isUsed(): boolean {
    return this.status === 'used';
  }

  // 实例方法：标记为已使用
  public async markAsUsed(options: { transaction?: Transaction } = {}): Promise<this> {
    if (this.status === 'used') {
      throw new Error('抽奖码已经使用过了');
    }

    this.status = 'used';
    this.used_at = new Date();
    await this.save({ transaction: options.transaction });

    return this;
  }

  // 实例方法：重置为未使用
  public async markAsUnused(): Promise<this> {
    this.status = 'unused';
    this.used_at = null;
    await this.save();

    return this;
  }

  // 实例方法：标记为作废
  public async markAsInvalid(): Promise<this> {
    if (this.status === 'invalid') {
      throw new Error('抽奖码已经作废了');
    }

    this.status = 'invalid';
    await this.save();

    return this;
  }

  // 实例方法：更新参与者信息
  public async updateParticipantInfo(participantInfo: ParticipantInfo): Promise<this> {
    this.participant_info = participantInfo;
    await this.save();

    return this;
  }

  // 实例方法：获取参与者信息
  public getParticipantInfo(): ParticipantInfo {
    return this.participant_info || {};
  }

  // 类方法：通过活动ID和抽奖码查找
  public static async findByActivityAndCode(activityId: number, code: string): Promise<LotteryCode | null> {
    return await this.findOne({
      where: {
        activity_id: activityId,
        code: code
      }
    });
  }

  // 类方法：获取活动的抽奖码列表
  public static async findByActivity(
    activityId: number,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      has_participant_info?: boolean;
    } = {}
  ): Promise<Record<string, unknown>> {
    const { page = 1, limit = 20, search, status, has_participant_info } = options;

    const offset = (page - 1) * limit;
    const whereClause: Record<string, unknown> = { activity_id: activityId };

    if (status) {
      whereClause.status = status;
    }

    if (has_participant_info !== undefined) {
      if (has_participant_info) {
        whereClause.participant_info = { [Op.ne]: null };
      } else {
        whereClause.participant_info = { [Op.is]: null };
      }
    }

    if (search) {
      whereClause[Op.or as any] = [
        { code: { [Op.like]: `%${search}%` } },
        sequelize.literal(`JSON_EXTRACT(participant_info, '$.name') LIKE '%${search}%'`),
        sequelize.literal(`JSON_EXTRACT(participant_info, '$.phone') LIKE '%${search}%'`),
        sequelize.literal(`JSON_EXTRACT(participant_info, '$.email') LIKE '%${search}%'`)
      ];
    }

    const { count, rows } = await this.findAndCountAll({
      where: whereClause as any,
      order: [['created_at', 'DESC']],
      limit: parseInt(String(limit)),
      offset: parseInt(String(offset))
    });

    return {
      lottery_codes: rows,
      pagination: {
        total: count,
        page: parseInt(String(page)),
        limit: parseInt(String(limit)),
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  // 类方法：批量创建抽奖码
  public static async createBatch(
    activityId: number,
    codes: string[],
    participantInfoList: (ParticipantInfo | null)[] = []
  ): Promise<LotteryCode[]> {
    const lotteryCodeData = codes.map((code, index) => ({
      activity_id: activityId,
      code: code,
      participant_info: participantInfoList[index] || null,
      status: 'unused'
    }));

    return await this.bulkCreate(lotteryCodeData as any, {
      validate: true,
      ignoreDuplicates: false
    });
  }

  // 类方法：检查抽奖码是否已存在
  public static async checkDuplicates(activityId: number, codes: string[]): Promise<string[]> {
    const existingCodes = await this.findAll({
      where: {
        activity_id: activityId,
        code: { [Op.in]: codes }
      },
      attributes: ['code']
    });

    return existingCodes.map((item: LotteryCode) => item.code);
  }

  // 类方法：获取活动的已使用抽奖码
  public static async getUsedCodes(activityId: number): Promise<LotteryCode[]> {
    return await this.findAll({
      where: {
        activity_id: activityId,
        status: 'used'
      },
      order: [['used_at', 'DESC']]
    });
  }

  // 类方法：获取活动抽奖码统计
  public static async getStatistics(activityId: number): Promise<Record<string, unknown>> {
    const [totalCount, usedCount] = await Promise.all([
      this.count({ where: { activity_id: activityId } }),
      this.count({ where: { activity_id: activityId, status: 'used' } })
    ]);

    const unusedCount = totalCount - usedCount;
    const usageRate = totalCount > 0 ? ((usedCount / totalCount) * 100).toFixed(2) : '0.00';

    return {
      total_count: totalCount,
      used_count: usedCount,
      unused_count: unusedCount,
      usage_rate: usageRate
    };
  }

  // 类方法：获取活动的所有抽奖码（用于去重检查）
  public static async getAllCodesForActivity(activityId: number): Promise<string[]> {
    const codes = await this.findAll({
      where: { activity_id: activityId },
      attributes: ['code']
    });

    return codes.map((item: LotteryCode) => item.code);
  }
}

LotteryCode.init(
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
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        len: [1, 50],
        notEmpty: true
      }
    },
    status: {
      type: DataTypes.ENUM('unused', 'used', 'invalid'),
      allowNull: false,
      defaultValue: 'unused'
    },
    participant_info: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'participant_info',
      comment: '参与者信息：name, phone, email等'
    },
    used_at: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'used_at'
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
    tableName: 'lottery_codes',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['activity_id', 'code'],
        name: 'unique_activity_code'
      }
    ],
    hooks: {
      beforeUpdate: (lotteryCode: LotteryCode) => {
        lotteryCode.updated_at = new Date();

        // 如果状态从unused变为used，设置使用时间
        if (lotteryCode.changed('status') && lotteryCode.status === 'used' && !lotteryCode.used_at) {
          lotteryCode.used_at = new Date();
        }
      }
    }
  }
);

export default LotteryCode;

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import bcrypt from 'bcryptjs';

// 用户属性
export interface UserAttributes {
  id: number;
  username: string;
  password_hash: string;
  email: string | null;
  role: 'super_admin' | 'admin';
  status: 'active' | 'inactive';
  created_at: Date;
  updated_at: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'created_at' | 'updated_at'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public username!: string;
  public password_hash!: string;
  public email!: string | null;
  public role!: 'super_admin' | 'admin';
  public status!: 'active' | 'inactive';
  public created_at!: Date;
  public updated_at!: Date;

  // 实例方法：验证密码
  public async validatePassword(password: string): Promise<boolean> {
    return await bcrypt.compare(password, this.password_hash);
  }

  // 实例方法：设置密码
  public async setPassword(password: string): Promise<void> {
    this.password_hash = await bcrypt.hash(password, 12);
  }

  // 实例方法：转换为安全的JSON对象（不包含密码）
  public toSafeJSON(): Record<string, unknown> {
    const user = this.toJSON() as unknown as Record<string, unknown>;
    delete user.password_hash;
    return user;
  }

  // 类方法：通过用户名查找用户
  public static async findByUsername(username: string): Promise<User | null> {
    return await this.findOne({
      where: { username }
    });
  }

  // 类方法：创建用户
  public static async createUser(userData: {
    username: string;
    email: string;
    password: string;
    role?: 'super_admin' | 'admin';
  }): Promise<User> {
    const { username, email, password, role = 'admin' } = userData;

    const user = await this.create({
      username,
      email,
      role,
      status: 'active'
    });

    await user.setPassword(password);
    await user.save();

    return user;
  }
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],
        notEmpty: true
      }
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'password_hash'
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    role: {
      type: DataTypes.ENUM('super_admin', 'admin'),
      allowNull: false,
      defaultValue: 'admin'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      allowNull: false,
      defaultValue: 'active'
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
    tableName: 'users',
    timestamps: false, // 我们手动管理时间戳字段
    hooks: {
      beforeUpdate: (user: User) => {
        user.updated_at = new Date();
      }
    }
  }
);

export default User;

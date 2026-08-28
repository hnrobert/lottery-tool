import bcrypt from 'bcryptjs';
import { AppDataSource } from '../utils/database';
import { User, UserRole } from '../entities/user.entity';

export interface SafeUser {
  id: number;
  username: string;
  email: string | null;
  role: UserRole;
  status: string;
  created_at: Date;
  updated_at: Date;
}

// 剥离密码哈希的安全视图（原 User.toSafeJSON）
export const toSafeUser = (user: User): SafeUser => {
  const { password_hash, ...safe } = user;
  return safe as SafeUser;
};

export const findById = (id: number): Promise<User | null> =>
  AppDataSource.getRepository(User).findOneBy({ id });

export const findByUsername = (username: string): Promise<User | null> =>
  AppDataSource.getRepository(User).findOneBy({ username });

export const findByEmail = (email: string): Promise<User | null> =>
  AppDataSource.getRepository(User).findOneBy({ email });

export const validatePassword = (user: User, password: string): Promise<boolean> =>
  bcrypt.compare(password, user.password_hash);

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, 12);

// 原User.createUser：创建后哈希密码
export async function createUser(userData: {
  username: string;
  email: string | null;
  password: string;
  role?: UserRole;
}): Promise<User> {
  const { username, email, password, role = 'admin' } = userData;
  const user = await AppDataSource.getRepository(User).save({
    username,
    email,
    role,
    status: 'active',
    password_hash: await hashPassword(password),
  });
  return user;
}

// 修改密码（原 setPassword + save）
export async function updatePassword(user: User, newPassword: string): Promise<void> {
  user.password_hash = await hashPassword(newPassword);
  await AppDataSource.getRepository(User).save(user);
}

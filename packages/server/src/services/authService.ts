import bcrypt from 'bcrypt';
import { prisma } from '../config/database.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';

const SALT_ROUNDS = 10;

function generateTokens(userId: string, isGuest: boolean) {
  const payload = { userId, isGuest };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
    expiresIn: isGuest ? 86400 : 7200,
  };
}

function formatUser(user: { id: string; nickname: string; avatar: string; isGuest: boolean }) {
  return { id: user.id, nickname: user.nickname, avatar: user.avatar, isGuest: user.isGuest };
}

export async function guestLogin(nickname: string) {
  if (!nickname || nickname.trim().length === 0 || nickname.length > 20) {
    throw new AppError(400, '昵称需为1-20个字符', 'INVALID_PARAMS');
  }

  const user = await prisma.user.create({
    data: {
      nickname: nickname.trim(),
      isGuest: true,
      lastLoginAt: new Date(),
      stats: { create: {} },
    },
  });

  return {
    user: formatUser(user),
    ...generateTokens(user.id, true),
  };
}

export async function register(nickname: string, email: string, password: string) {
  if (!nickname || nickname.trim().length === 0 || nickname.length > 20) {
    throw new AppError(400, '昵称需为1-20个字符', 'INVALID_PARAMS');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, '邮箱格式不正确', 'INVALID_PARAMS');
  }
  if (!password || password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    throw new AppError(400, '密码至少8位，需包含字母和数字', 'INVALID_PARAMS');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, '邮箱已被注册', 'EMAIL_EXISTS');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      nickname: nickname.trim(),
      email,
      passwordHash,
      isGuest: false,
      lastLoginAt: new Date(),
      stats: { create: {} },
    },
  });

  return {
    user: formatUser(user),
    ...generateTokens(user.id, false),
  };
}

export async function login(email: string, password: string) {
  if (!email || !password) {
    throw new AppError(400, '请输入邮箱和密码', 'INVALID_PARAMS');
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    throw new AppError(401, '邮箱或密码错误', 'INVALID_CREDENTIALS');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, '邮箱或密码错误', 'INVALID_CREDENTIALS');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    user: formatUser(user),
    ...generateTokens(user.id, user.isGuest),
  };
}

export async function refreshToken(token: string) {
  if (!token) {
    throw new AppError(400, 'refreshToken不能为空', 'INVALID_PARAMS');
  }

  try {
    const payload = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      throw new AppError(401, '用户不存在', 'UNAUTHORIZED');
    }

    return {
      accessToken: signAccessToken({ userId: user.id, isGuest: user.isGuest }),
      expiresIn: user.isGuest ? 86400 : 7200,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(401, 'refreshToken无效或已过期', 'TOKEN_EXPIRED');
  }
}

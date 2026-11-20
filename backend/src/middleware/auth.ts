import { createHash, randomBytes } from 'crypto';
import { CookieOptions, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { User } from '../models/User';
import Session from '../models/Session';
import Member from '../models/Member';
import { AppError } from './errorHandler';
import Cooperative from '../models/Cooperative';
import { isConfiguredOwner, ownerRole } from '../config/platform';

export const newToken = () => randomBytes(32).toString('hex');
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

export function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('JWT_SECRET must contain at least 32 bytes');
  }
  return secret;
}

export const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.COOKIE_CROSS_SITE === 'true' ? 'none' : 'lax'
};

export function setSessionCookies(res: Response, session: Session, refresh: string) {
  const token = jwt.sign({ sid: session.id, sub: session.userId }, jwtSecret(), {
    algorithm: 'HS256',
    expiresIn: '15m'
  });
  res.cookie('token', token, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie('refresh', refresh, {
    ...cookieOptions,
    path: '/api/auth',
    expires: session.expiresAt
  });
}

declare global {
  namespace Express {
    interface Request {
      user?: User & { cooperativeId: string };
      platformOwner?: User;
    }
  }
}

export async function canSignIn(user: User) {
  if (!user.isActive || !user.isEmailVerified) return false;
  if (user.role === ownerRole) return isConfiguredOwner(user);
  if (!user.cooperativeId || !await Cooperative.findOne({ where: { id: user.cooperativeId, suspendedAt: null }, attributes: ['id'] })) return false;
  if (user.role === 'admin' || user.role === 'staff') return true;
  if (user.role !== 'member') return false;

  return Boolean(await Member.findOne({
    where: { userId: user.id, cooperativeId: user.cooperativeId, status: 'active' },
    attributes: ['id']
  }));
}

export async function sessionAccount(req: Request) {
  const token = req.cookies.token;
  if (typeof token !== 'string') throw new AppError('Please log in', 401);
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] }) as jwt.JwtPayload;
  } catch {
    throw new AppError('Please log in', 401);
  }
  const session = await Session.findOne({
    where: { id: payload.sid, userId: payload.sub, expiresAt: { [Op.gt]: new Date() } }
  });
  const user = session && await User.findByPk(session.userId);
  if (!user || !await canSignIn(user)) throw new AppError('Please log in', 401);
  return user;
}

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const user = await sessionAccount(req);
    if (!user.cooperativeId || user.role === ownerRole) throw new AppError('Permission denied', 403);
    req.user = user as Express.Request['user'];
    return next();
  } catch (error) {
    return next(error);
  }
};

export const authenticateOwner = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const user = await sessionAccount(req);
    if (!isConfiguredOwner(user)) throw new AppError('Permission denied', 403);
    req.platformOwner = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

export const restrictTo = (...roles: string[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError('Please log in', 401));
  if (!roles.includes(req.user.role)) return next(new AppError('Permission denied', 403));
  return next();
};

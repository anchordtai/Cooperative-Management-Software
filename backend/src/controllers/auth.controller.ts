import { brand } from '../config/brand';
import { internalOwnerDomain, isConfiguredOwner, ownerAccountId, ownerEmail, ownerRole } from '../config/platform';
import { randomInt } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import sequelize from '../config/database';
import Cooperative from '../models/Cooperative';
import Session from '../models/Session';
import { User } from '../models/User';
import { isEmailConfigured, sendEmail } from '../utils/email';
import { canSignIn, cookieOptions, newToken, setSessionCookies, sessionAccount, tokenHash } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const oneHour = 60 * 60 * 1000;
const frontend = () => process.env.FRONTEND_URL || 'http://localhost:3000';
const normalizedEmail = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '';

const accountLookup = (email: unknown, platform: boolean) => {
  const normalized = normalizedEmail(email);
  if (platform) return normalized && normalized === ownerEmail() ? ownerAccountId(normalized) : '';
  return normalized.endsWith(internalOwnerDomain) ? '' : normalized;
};

const serialize = (user: User) => ({
  id: user.id, email: user.role === ownerRole ? ownerEmail() : user.email, role: user.role, cooperativeId: user.cooperativeId,
  firstName: user.firstName, lastName: user.lastName, phone: user.phone, permissions: user.permissions
});

const strongPassword = (value: unknown): value is string => (
  typeof value === 'string' && value.length >= 12 && Buffer.byteLength(value) <= 72
);

async function deliver(email: string, subject: string, message: string) {
  try {
    await sendEmail(email, subject, message);
    return true;
  } catch {
    console.error('Account email delivery failed');
    return false;
  }
}

async function sendVerification(user: User) {
  const token = newToken();
  await user.update({
    emailVerificationToken: tokenHash(token),
    emailVerificationExpires: new Date(Date.now() + 24 * oneHour)
  });
  return deliver(user.email, `Verify your ${brand.name} account`, `${frontend()}/verify-account#token=${token}`);
}

function issueSession(res: Response, user: User, session: Session, refresh: string) {
  setSessionCookies(res, session, refresh);
  res.json({ status: 'success', data: { user: serialize(user) } });
}

async function startSession(res: Response, user: User) {
  const refresh = newToken();
  const session = await Session.create({
    userId: user.id, refreshHash: tokenHash(refresh), expiresAt: new Date(Date.now() + 7 * 24 * oneHour)
  });
  issueSession(res, user, session, refresh);
}

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password, firstName, lastName, phone, cooperativeName } = req.body;
    const email = normalizedEmail(req.body.email);
    const required = [firstName, lastName, phone, cooperativeName];
    if (!email || !strongPassword(password) ||
      !required.every(value => typeof value === 'string' && value.trim() && value.length <= 160)) {
      throw new AppError('Enter a cooperative name, full name, email, phone and a password of at least 12 characters', 400);
    }

    if (process.env.NODE_ENV === 'production' && !isEmailConfigured()) {
      throw new AppError('Registration is temporarily unavailable because verification email is offline. Please try again later.', 503);
    }

    if (email.endsWith(internalOwnerDomain)) throw new AppError('Enter a valid email address.', 400);

    const user = await sequelize.transaction(async transaction => {
      const cooperative = await Cooperative.create({ name: cooperativeName.trim() }, { transaction });
      return User.create({
        cooperativeId: cooperative.id, role: 'admin', email, password,
        firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim()
      }, { transaction });
    });
    const delivered = await sendVerification(user);
    res.status(201).json({
      status: 'success',
      data: { email: user.email, delivered }
    });
  } catch (error) {
    next(error);
  }
};

export const acceptInvitation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, password } = req.body;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !strongPassword(password)) {
      throw new AppError('Supply a valid invitation and a password of at least 12 characters', 400);
    }
    await sequelize.transaction(async transaction => {
      const user = await User.findOne({
        where: {
          role: { [Op.in]: ['member', 'staff'] }, isEmailVerified: false,
          emailVerificationToken: tokenHash(token), emailVerificationExpires: { [Op.gt]: new Date() }
        },
        lock: transaction.LOCK.UPDATE, transaction
      });
      if (!user) throw new AppError('Invalid or expired invitation', 400);
      await user.update({
        password, isEmailVerified: true, emailVerificationToken: null, emailVerificationExpires: null
      }, { transaction });
    });
    res.json({ message: 'Account activated. You can now log in.' });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
      throw new AppError('Invalid or expired verification link', 400);
    }
    const [updated] = await User.update({
      isEmailVerified: true, emailVerificationToken: null, emailVerificationExpires: null
    }, {
      where: { role: 'admin', emailVerificationToken: tokenHash(token), emailVerificationExpires: { [Op.gt]: new Date() } }
    });
    if (!updated) throw new AppError('Invalid or expired verification link', 400);
    res.json({ message: 'Email verified. You can now sign in.' });
  } catch (error) {
    next(error);
  }
};

export const resendEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findOne({ where: { email: normalizedEmail(req.body.email), isEmailVerified: false } });
    if (user?.cooperativeId && user.role === 'admin') await sendVerification(user);
    res.json({ message: 'If verification is pending, check your email for a new link.' });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password } = req.body;
    if (typeof password !== 'string' || Buffer.byteLength(password) > 72) {
      throw new AppError('Invalid credentials', 401);
    }
    const platform = req.body.platform === true;
    const user = await User.findOne({ where: { email: accountLookup(req.body.email, platform) } });
    const comparableHash = user?.password || '$2a$10$ugDlaveH8binRfnB4fVmRujs1xzAqAnqlQ78eDm71FGYgzyWHvU42';
    if (!await bcrypt.compare(password, comparableHash) || !user || (platform ? !isConfiguredOwner(user) : !user.cooperativeId || user.role === ownerRole)) {
      throw new AppError('Invalid credentials', 401);
    }
    if (!user.isEmailVerified) {
      res.status(403).json({ message: 'Verify your email to continue.', requiresVerification: true, verificationType: 'email' });
      return;
    }
    if (!await canSignIn(user)) throw new AppError('Your account is awaiting activation or has been suspended', 403);

    if (user.twoFAEnabled) {
      const code = randomInt(100000, 1000000).toString();
      const challenge = newToken();
      res.cookie('challenge', challenge, { ...cookieOptions, path: '/api/auth', maxAge: 10 * 60 * 1000 });
      await user.update({ twoFACode: tokenHash(challenge + code), twoFACodeExpires: new Date(Date.now() + 10 * 60 * 1000) });
      if (!await deliver(platform ? ownerEmail() : user.email, `Your ${brand.name} verification code`, code)) {
        throw new AppError('Verification email could not be delivered', 503);
      }
      res.json({ require2FA: true, twoFAMethod: 'email', message: 'Check your email for the verification code.' });
      return;
    }

    await startSession(res, user);
  } catch (error) {
    next(error);
  }
};

export const verify2FA = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body;
    const challenge = req.cookies.challenge;
    if (typeof code !== 'string' || !/^\d{6}$/.test(code) || typeof challenge !== 'string') {
      throw new AppError('Invalid or expired verification code', 400);
    }
    const user = await sequelize.transaction(async transaction => {
      const account = await User.findOne({
        where: {
          email: accountLookup(req.body.email, req.body.platform === true), twoFAEnabled: true, twoFACode: tokenHash(challenge + code),
          twoFACodeExpires: { [Op.gt]: new Date() }
        },
        lock: transaction.LOCK.UPDATE, transaction
      });
      if (!account || !await canSignIn(account)) throw new AppError('Invalid or expired verification code', 400);
      await account.update({ twoFACode: null, twoFACodeExpires: null }, { transaction });
      return account;
    });
    res.clearCookie('challenge', { ...cookieOptions, path: '/api/auth' });
    await startSession(res, user);
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (typeof req.cookies.refresh === 'string') {
      await Session.destroy({ where: { refreshHash: tokenHash(req.cookies.refresh) } });
    }
    res.clearCookie('token', cookieOptions);
    res.clearCookie('refresh', { ...cookieOptions, path: '/api/auth' });
    res.clearCookie('challenge', { ...cookieOptions, path: '/api/auth' });
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (typeof req.cookies.refresh !== 'string') throw new AppError('Please log in', 401);
    const refresh = newToken();
    const result = await sequelize.transaction(async transaction => {
      const session = await Session.findOne({
        where: { refreshHash: tokenHash(req.cookies.refresh), expiresAt: { [Op.gt]: new Date() } },
        lock: transaction.LOCK.UPDATE, transaction
      });
      const user = session && await User.findByPk(session.userId, { transaction });
      if (!session || !user || !await canSignIn(user)) throw new AppError('Please log in', 401);
      await session.update({ refreshHash: tokenHash(refresh) }, { transaction });
      return { user, session };
    });
    issueSession(res, result.user, result.session, refresh);
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ user: serialize(await sessionAccount(req)) });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const platform = req.body.platform === true;
    const user = await User.findOne({ where: { email: accountLookup(req.body.email, platform) } });
    if (user && (platform ? isConfiguredOwner(user) : user.cooperativeId && user.isEmailVerified)) {
      const token = newToken();
      await user.update({ passwordResetToken: tokenHash(token), passwordResetExpires: new Date(Date.now() + oneHour) });
      const path = platform ? '/platform/reset-password' : '/reset-password';
      await deliver(platform ? ownerEmail() : user.email, `Reset your ${brand.name} ${platform ? 'platform owner ' : ''}password`, `${frontend()}${path}#token=${token}`);
    }
    res.json({ message: 'If the account is eligible, check your email for a reset link.' });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, password } = req.body;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !strongPassword(password)) {
      throw new AppError('Supply a valid reset link and a password of at least 12 characters', 400);
    }
    await sequelize.transaction(async transaction => {
      const user = await User.findOne({
        where: { passwordResetToken: tokenHash(token), passwordResetExpires: { [Op.gt]: new Date() } },
        lock: transaction.LOCK.UPDATE, transaction
      });
      const platform = req.body.platform === true;
      if (!user || (platform ? !isConfiguredOwner(user) : user.role === ownerRole)) {
        throw new AppError('Invalid or expired reset link', 400);
      }
      await user.update({
        ...(isConfiguredOwner(user) ? { isEmailVerified: true } : {}),
        password, passwordResetToken: null, passwordResetExpires: null, twoFACode: null, twoFACodeExpires: null
      }, { transaction });
      await Session.destroy({ where: { userId: user.id }, transaction });
    });
    res.json({ message: 'Password updated. You can now log in.' });
  } catch (error) {
    next(error);
  }
};

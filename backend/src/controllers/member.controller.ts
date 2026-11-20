import { brand } from '../config/brand';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import sequelize from '../config/database';
import Member from '../models/Member';
import { User } from '../models/User';
import { AppError } from '../middleware/errorHandler';
import { newToken, tokenHash } from '../middleware/auth';
import { ownMember } from '../middleware/cooperative';
import { sendEmail } from '../utils/email';
import { checkCapacity } from '../services/subscriptions';

const statuses = ['active', 'inactive', 'suspended'];
const requiredText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 160;

export const getOwnMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ status: 'success', data: await ownMember(req) });
  } catch (error) {
    next(error);
  }
};

export const getAllMembers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const members = await Member.findAll({
      where: { cooperativeId: req.user!.cooperativeId }, order: [['createdAt', 'DESC']]
    });
    res.json({ status: 'success', results: members.length, data: members });
  } catch (error) {
    next(error);
  }
};

export const getMemberById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const member = await Member.findOne({ where: { id: req.params.id, cooperativeId: req.user!.cooperativeId } });
    if (!member) throw new AppError('Member not found', 404);
    res.json({ status: 'success', data: member });
  } catch (error) {
    next(error);
  }
};

export const createMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, phone, address, dateOfBirth, email } = req.body;
    if (![firstName, lastName, phone, email].every(requiredText) ||
      typeof address !== 'string' || address.length > 2000 ||
      (dateOfBirth && (typeof dateOfBirth !== 'string' || Number.isNaN(Date.parse(dateOfBirth))))) {
      throw new AppError('Enter the member name, email, phone and address', 400);
    }

    const cooperativeId = req.user!.cooperativeId;
    const member = await sequelize.transaction(async transaction => {
      await checkCapacity(cooperativeId, 1, transaction);
      return Member.create({
        cooperativeId, membershipNumber: `EC-${randomUUID()}`,
        firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(),
        email: email.trim().toLowerCase(), address: address.trim(), dateOfBirth: dateOfBirth || null,
        status: 'inactive'
      }, { transaction });
    });
    res.status(201).json({ status: 'success', data: member });
  } catch (error) {
    next(error);
  }
};

export const updateMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, phone, address, dateOfBirth, status } = req.body;
    if (status !== undefined && !statuses.includes(status)) throw new AppError('Invalid member status', 400);
    const member = await Member.findOne({ where: { id: req.params.id, cooperativeId: req.user!.cooperativeId } });
    if (!member) throw new AppError('Member not found', 404);

    const values: Record<string, unknown> = {};
    for (const [name, value] of Object.entries({ firstName, lastName, phone })) {
      if (value === undefined) continue;
      if (!requiredText(value)) throw new AppError(`Invalid ${name}`, 400);
      values[name] = value.trim();
    }
    if (address !== undefined) {
      if (typeof address !== 'string' || address.length > 2000) throw new AppError('Invalid address', 400);
      values.address = address.trim();
    }
    if (dateOfBirth !== undefined) {
      if (dateOfBirth !== null && (typeof dateOfBirth !== 'string' || Number.isNaN(Date.parse(dateOfBirth)))) {
        throw new AppError('Invalid date of birth', 400);
      }
      values.dateOfBirth = dateOfBirth;
    }
    if (status !== undefined) values.status = status;
    await member.update(values);
    res.json({ status: 'success', data: member });
  } catch (error) {
    next(error);
  }
};

export const deleteMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [updated] = await Member.update({ status: 'inactive' }, {
      where: { id: req.params.id, cooperativeId: req.user!.cooperativeId }
    });
    if (!updated) throw new AppError('Member not found', 404);
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
};

export const inviteMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cooperativeId } = req.user!;
    const token = newToken();
    const email = await sequelize.transaction(async transaction => {
      const member = await Member.findOne({
        where: { id: req.params.id, cooperativeId }, transaction, lock: transaction.LOCK.UPDATE
      });
      if (!member) throw new AppError('Member not found', 404);
      if (member.status !== 'active' || !member.email) {
        throw new AppError('Activate the member and record an email address before sending an invitation', 400);
      }
      const invitation = {
        emailVerificationToken: tokenHash(token),
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
      if (member.userId) {
        const user = await User.findOne({ where: { id: member.userId, cooperativeId, role: 'member' }, transaction });
        if (!user || user.isEmailVerified) throw new AppError('This member already has a sign-in account', 409);
        await user.update(invitation, { transaction });
        return user.email;
      }

      const user = await User.create({
        cooperativeId, role: 'member', email: member.email, password: newToken(), firstName: member.firstName,
        lastName: member.lastName, phone: member.phone, ...invitation
      }, { transaction });
      await member.update({ userId: user.id }, { transaction });
      return user.email;
    });

    try {
      const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
      await sendEmail(email, `Activate your ${brand.name} membership`, `${frontend}/verify-account#invite=${token}`);
    } catch {
      throw new AppError('Invitation delivery failed. You can retry sending the invitation.', 503);
    }
    res.json({ message: 'Invitation sent' });
  } catch (error) {
    next(error);
  }
};

import { Request } from 'express';
import Member from '../models/Member';
import { AppError } from './errorHandler';

export async function ownMember(req: Request) {
  const { id, cooperativeId } = req.user!;
  const member = await Member.findOne({ where: { userId: id, cooperativeId, status: 'active' } });
  if (!member) throw new AppError('Member profile not found', 404);
  return member;
}

export async function financialScope(req: Request, memberId?: unknown) {
  const { cooperativeId, role } = req.user!;
  if (memberId !== undefined && typeof memberId !== 'string') throw new AppError('Invalid member ID', 400);
  if (role === 'member') {
    const member = await ownMember(req);
    if (memberId && memberId !== member.id) throw new AppError('Member records not found', 404);
    return { cooperativeId, memberId: member.id };
  }
  return memberId ? { cooperativeId, memberId } : { cooperativeId };
}

export function pagination(req: Request) {
  const { page = '1', limit = '50' } = req.query;
  const currentPage = Number(page);
  const limitNum = Number(limit);
  if (typeof page !== 'string' || typeof limit !== 'string' || !/^\d+$/.test(page) || !/^\d+$/.test(limit) ||
    !Number.isSafeInteger(currentPage) || currentPage < 1 || currentPage > 1000000 || limitNum < 1 || limitNum > 100) {
    throw new AppError('Page and limit are out of range', 400);
  }
  return { currentPage, limitNum, offset: (currentPage - 1) * limitNum };
}

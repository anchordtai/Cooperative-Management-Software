import { RequestHandler } from 'express';
import { AppError } from './errorHandler';

export const staffPermissions = [
  'members.read', 'finance.read', 'loans.submit', 'loans.decide', 'loans.post',
  'savings.deposit', 'withdrawals.decide', 'reports.read', 'audit.read'
];

export const permit = (permission: string, memberAllowed = false): RequestHandler => (req, _res, next) => {
  const { role, permissions } = req.user!;
  if (role === 'admin' || (role === 'staff' && permissions.includes(permission)) || (role === 'member' && memberAllowed)) {
    return next();
  }
  return next(new AppError('Permission denied', 403));
};

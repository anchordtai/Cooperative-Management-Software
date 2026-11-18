import { permit } from '../middleware/permissions';
import { Request, Response, NextFunction, Router } from 'express';
import { authenticate, restrictTo } from '../middleware/auth';
import { financialScope, ownMember, pagination } from '../middleware/cooperative';
import { AppError } from '../middleware/errorHandler';
import sequelize from '../config/database';
import Transaction from '../models/Transaction';
import Member from '../models/Member';
import { recordAudit } from '../services/audit';
import { money, positiveAmount, postEntry, requiredTransferReference, toMinorUnits } from '../services/finance';

const memberDetails = { model: Member, as: 'Member', attributes: ['firstName', 'lastName'] };

export const getAllTransactions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scope = await financialScope(req, req.params.memberId || req.query.memberId);
    const { currentPage, limitNum, offset } = pagination(req);
    const { type } = req.query;
    if (type !== undefined && (typeof type !== 'string' || !['deposit', 'withdrawal', 'loan', 'repayment'].includes(type))) {
      throw new AppError('Invalid transaction type', 400);
    }
    const { count, rows } = await Transaction.findAndCountAll({
      where: { ...scope, ...(type === undefined ? {} : { type }) },
      include: [memberDetails],
      limit: limitNum, offset, order: [['createdAt', 'DESC'], ['id', 'DESC']]
    });
    res.json({ status: 'success', results: count, totalPages: Math.ceil(count / limitNum), currentPage, data: rows });
  } catch (error) {
    next(error);
  }
};

export const getTransactionById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transaction = await Transaction.findOne({
      where: { ...await financialScope(req), id: req.params.id }, include: [memberDetails]
    });
    if (!transaction) throw new AppError('Transaction not found', 404);
    res.json({ status: 'success', data: transaction });
  } catch (error) {
    next(error);
  }
};

export const createTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { memberId, description, type } = req.body;
    const { cooperativeId, id } = req.user!;
    const cents = positiveAmount(req.body.amount);
    const externalReference = requiredTransferReference(req.body.reference);
    if (typeof memberId !== 'string' || typeof description !== 'string' || !description.trim() ||
      description.length > 1000) {
      throw new AppError('Enter a member, description and positive amount with up to two decimal places', 400);
    }
    if (type !== 'deposit') throw new AppError('This endpoint records savings deposits only', 400);

    const entry = await sequelize.transaction(async transaction => {
      const member = await Member.findOne({
        where: { id: memberId, cooperativeId, status: 'active' }, transaction, lock: transaction.LOCK.UPDATE
      });
      if (!member) throw new AppError('Active member not found', 404);
      const balance = toMinorUnits(member.savings || 0) + cents;
      if (balance > 9999999999) throw new AppError('Savings limit exceeded', 400);
      await member.update({ savings: money(balance) }, { transaction });
      const deposit = await Transaction.create({
        cooperativeId, memberId, type, amount: money(cents), description: description.trim(), status: 'completed',
        requestedBy: id, handledBy: id, externalReference
      }, { transaction });
      await postEntry(transaction, cooperativeId, deposit.id, 1, 'cash', 'member_savings', cents);
      await recordAudit(transaction, cooperativeId, id, 'savings.deposit', deposit.id);
      return deposit;
    });
    res.status(201).json({ status: 'success', data: entry });
  } catch (error) {
    next(error);
  }
};

const requestWithdrawal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const own = await ownMember(req);
    const { cooperativeId, id } = req.user!;
    const amount = positiveAmount(req.body.amount);
    const withdrawal = await sequelize.transaction(async transaction => {
      const member = await Member.findOne({
        where: { id: own.id, cooperativeId, status: 'active' },
        lock: transaction.LOCK.UPDATE, transaction
      });
      if (!member) throw new AppError('Active membership not found', 404);
      const pending = await Transaction.findAll({
        where: { cooperativeId, memberId: member.id, type: 'withdrawal', status: 'pending' },
        attributes: ['amount'], transaction
      });
      const reserved = pending.reduce((total, entry) => total + positiveAmount(entry.amount), 0);
      if (amount > toMinorUnits(member.savings || 0) - reserved) {
        throw new AppError('Insufficient available savings after pending requests', 409);
      }
      return Transaction.create({
        cooperativeId, memberId: member.id, type: 'withdrawal',
        amount: money(amount), description: 'Savings withdrawal', status: 'pending', requestedBy: id
      }, { transaction });
    });
    res.status(201).json({ status: 'success', data: withdrawal });
  } catch (error) {
    next(error);
  }
};

const decideWithdrawal = (status: 'completed' | 'failed') => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cooperativeId, id } = req.user!;
    const withdrawal = await sequelize.transaction(async transaction => {
      const entry = await Transaction.findOne({
        where: { cooperativeId, id: req.params.id, type: 'withdrawal' },
        transaction, lock: transaction.LOCK.UPDATE
      });
      if (!entry) throw new AppError('Withdrawal not found', 404);
      if (entry.status !== 'pending' || !entry.requestedBy || entry.requestedBy === id) {
        throw new AppError('Withdrawal cannot be approved or rejected by this account', 409);
      }

      let externalReference: string | null = null;
      if (status === 'completed') {
        externalReference = requiredTransferReference(req.body?.reference);
        const member = await Member.findOne({
          where: { cooperativeId, id: entry.memberId, status: 'active' }, transaction, lock: transaction.LOCK.UPDATE
        });
        if (!member) throw new AppError('Member is inactive', 409);
        const cents = positiveAmount(entry.amount);
        const balance = toMinorUnits(member.savings || 0) - cents;
        if (balance < 0) throw new AppError('Insufficient savings', 409);
        await member.update({ savings: money(balance) }, { transaction });
        await postEntry(transaction, cooperativeId, entry.id, 1, 'member_savings', 'cash', cents);
      }

      await entry.update({ status, handledBy: id, externalReference }, { transaction });
      await recordAudit(transaction, cooperativeId, id, `withdrawal.${status}`, entry.id);
      return entry;
    });
    res.json({ status: 'success', data: withdrawal });
  } catch (error) {
    next(error);
  }
};

const router = Router();
router.use(authenticate);
router.get('/', permit('finance.read', true), getAllTransactions);
router.get('/my', restrictTo('member'), getAllTransactions);
router.get('/member/:memberId', permit('finance.read', true), getAllTransactions);
router.get('/:id', permit('finance.read', true), getTransactionById);
router.post('/', permit('savings.deposit'), createTransaction);
router.post('/withdrawals', restrictTo('member'), requestWithdrawal);
router.patch('/withdrawals/:id/approve', permit('withdrawals.decide'), decideWithdrawal('completed'));
router.patch('/withdrawals/:id/reject', permit('withdrawals.decide'), decideWithdrawal('failed'));

export default router;

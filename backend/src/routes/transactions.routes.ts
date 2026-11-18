import { Request, Response, NextFunction, Router } from 'express';
import { authenticate, restrictTo } from '../middleware/auth';
import { financialScope, pagination } from '../middleware/cooperative';
import { AppError } from '../middleware/errorHandler';
import sequelize from '../config/database';
import Transaction from '../models/Transaction';
import Member from '../models/Member';

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
    const { cooperativeId } = req.user!;
    const amount = String(req.body.amount);
    if (typeof memberId !== 'string' || typeof description !== 'string' || !description.trim() ||
      description.length > 1000 || !/^\d{1,8}(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
      throw new AppError('Enter a member, description and positive amount with up to two decimal places', 400);
    }
    if (type !== 'deposit') throw new AppError('This endpoint records savings deposits only', 400);

    const entry = await sequelize.transaction(async transaction => {
      const member = await Member.findOne({
        where: { id: memberId, cooperativeId, status: 'active' }, transaction, lock: transaction.LOCK.UPDATE
      });
      if (!member) throw new AppError('Active member not found', 404);
      await member.increment('savings', { by: Number(amount), transaction });
      return Transaction.create({
        cooperativeId, memberId, type, amount, description: description.trim(), status: 'completed'
      }, { transaction });
    });
    res.status(201).json({ status: 'success', data: entry });
  } catch (error) {
    next(error);
  }
};

const router = Router();
router.use(authenticate);
router.get('/', getAllTransactions);
router.get('/my', restrictTo('member'), getAllTransactions);
router.get('/member/:memberId', getAllTransactions);
router.get('/:id', getTransactionById);
router.post('/', restrictTo('admin'), createTransaction);

export default router;

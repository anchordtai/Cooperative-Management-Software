import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, restrictTo } from '../middleware/auth';
import { financialScope, ownMember, pagination } from '../middleware/cooperative';
import { AppError } from '../middleware/errorHandler';
import Loan from '../models/Loan';
import Member from '../models/Member';
import { createTransaction, getAllTransactions, getTransactionById } from './transactions.routes';

const memberDetails = { model: Member, as: 'Member', attributes: ['firstName', 'lastName'] };
const loanStatuses = ['pending', 'approved', 'rejected', 'active', 'completed'];

const getAllLoans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scope = await financialScope(req, req.query.memberId);
    const { currentPage, limitNum, offset } = pagination(req);
    const { status } = req.query;
    if (status !== undefined && (typeof status !== 'string' || !loanStatuses.includes(status))) {
      throw new AppError('Invalid loan status', 400);
    }
    const { count, rows } = await Loan.findAndCountAll({
      where: { ...scope, ...(status === undefined ? {} : { status }) },
      include: [memberDetails], limit: limitNum, offset, order: [['createdAt', 'DESC'], ['id', 'DESC']]
    });
    res.json({ status: 'success', results: count, totalPages: Math.ceil(count / limitNum), currentPage, data: rows });
  } catch (error) {
    next(error);
  }
};

const createLoan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cooperativeId, role } = req.user!;
    const { purpose } = req.body;
    const amount = String(req.body.amount);
    const term = Number(req.body.term);
    if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 ||
      typeof purpose !== 'string' || !purpose.trim() || purpose.length > 255 ||
      !['string', 'number'].includes(typeof req.body.term) || !Number.isInteger(term) || term < 1 || term > 120) {
      throw new AppError('Enter an amount, purpose and loan term from 1 to 120 months', 400);
    }
    const member = role === 'member' ? await ownMember(req) : await Member.findOne({
      where: { cooperativeId, id: req.body.memberId ?? null, status: 'active' }
    });
    if (!member) throw new AppError('Active member not found', 404);

    const loan = await Loan.create({
      cooperativeId, memberId: member.id, amount, purpose: purpose.trim(), term, interestRate: 5,
      status: 'pending', remainingBalance: 0, startDate: null, endDate: null
    });
    res.status(201).json({ status: 'success', data: loan });
  } catch (error) {
    next(error);
  }
};

const getLoanById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const loan = await Loan.findOne({
      where: { ...await financialScope(req), id: req.params.id }, include: [memberDetails]
    });
    if (!loan) throw new AppError('Loan not found', 404);
    res.json({ status: 'success', data: loan });
  } catch (error) {
    next(error);
  }
};

const decideLoan = (status: 'approved' | 'rejected') => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where = { id: req.params.id, cooperativeId: req.user!.cooperativeId };
    const [updated, loans] = await Loan.update({ status }, {
      where: { ...where, status: 'pending' }, returning: true
    });
    if (!updated) {
      const scoped = await Loan.findOne({ where, attributes: ['id'] });
      if (!scoped) throw new AppError('Loan not found', 404);
      throw new AppError('Only pending loans can be reviewed', 409);
    }
    res.json({ status: 'success', data: loans[0] });
  } catch (error) {
    next(error);
  }
};

const router = Router();
router.use(authenticate);
router.get('/transactions', getAllTransactions);
router.get('/transactions/:id', getTransactionById);
router.post('/transactions', restrictTo('admin'), createTransaction);
router.get('/loans', getAllLoans);
router.get('/loans/my', restrictTo('member'), getAllLoans);
router.get('/my-loans', restrictTo('member'), getAllLoans);
router.get('/loans/:id', getLoanById);
router.post('/loans', restrictTo('admin', 'staff', 'member'), createLoan);
router.patch('/loans/:id/approve', restrictTo('admin'), decideLoan('approved'));
router.patch('/loans/:id/reject', restrictTo('admin'), decideLoan('rejected'));

export default router;

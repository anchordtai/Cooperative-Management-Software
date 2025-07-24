import express from 'express';
import { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import Transaction from '../models/Transaction';
import Member from '../models/Member';

const router = express.Router();

// Get all transactions
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '10', type, memberId } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause for filtering
    const whereClause: any = {};
    if (type) whereClause.type = type;
    if (memberId) whereClause.memberId = memberId;

    const { count, rows: transactions } = await Transaction.findAndCountAll({
      where: whereClause,
      limit: limitNum,
      offset: offset,
      include: [{
        model: Member,
        as: 'member',
        attributes: ['firstName', 'lastName']
      }],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      status: 'success',
      results: count,
      totalPages: Math.ceil(count / limitNum),
      currentPage: pageNum,
      data: transactions
    });
  } catch (error) {
    next(error);
  }
});

// Create a transaction
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { memberId, type, amount, description } = req.body;
    
    if (!memberId || !type || !amount) {
      return next(new AppError('Please provide required fields', 400));
    }

    const newTransaction = await Transaction.create({
      memberId,
      type,
      amount: parseFloat(amount),
      description,
      status: 'completed'
    });

    res.status(201).json({ status: 'success', data: newTransaction });
  } catch (error) {
    next(error);
  }
});

// Get transaction by ID
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transaction = await Transaction.findByPk(req.params.id, {
      include: [{
        model: Member,
        as: 'member',
        attributes: ['firstName', 'lastName']
      }]
    });
    if (!transaction) return next(new AppError('Transaction not found', 404));
    res.status(200).json({ status: 'success', data: transaction });
  } catch (error) {
    next(error);
  }
});

// Get transactions by member
router.get('/member/:memberId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transactions = await Transaction.findAll({
      where: { memberId: req.params.memberId },
      include: [{
        model: Member,
        as: 'member',
        attributes: ['firstName', 'lastName']
      }],
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json({ status: 'success', results: transactions.length, data: transactions });
  } catch (error) {
    next(error);
  }
});

// Get transactions for the authenticated user
router.get('/my', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Get the userId from the JWT
    const userId = (req as any).user?.id;
    if (!userId) return next(new AppError('User not authenticated', 401));

    // 2. Find the member for this user
    const member = await Member.findOne({ where: { userId } });
    if (!member) return next(new AppError('Member not found for user', 404));

    // 3. Get all transactions for this member
    const transactions = await Transaction.findAll({
      where: { memberId: member.id },
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json({ status: 'success', results: transactions.length, data: transactions });
  } catch (error) {
    next(error);
  }
});

export default router; 
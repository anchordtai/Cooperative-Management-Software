import express from 'express';
import { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import Transaction from '../models/Transaction';
import Loan from '../models/Loan';
import Member from '../models/Member';


const router = express.Router();

// Transaction endpoints
export const getAllTransactions = async (req: Request, res: Response, next: NextFunction) => {
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
};

export const createTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { memberId, type, amount, description } = req.body;

    // Validate required fields
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

    res.status(201).json({
      status: 'success',
      data: newTransaction
    });
  } catch (error) {
    next(error);
  }
};

export const getTransactionById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transaction = await Transaction.findByPk(req.params.id, {
      include: [{
        model: Member,
        as: 'member',
        attributes: ['firstName', 'lastName']
      }]
    });
    
    if (!transaction) {
      return next(new AppError('Transaction not found', 404));
    }
    
    res.status(200).json({
      status: 'success',
      data: transaction
    });
  } catch (error) {
    next(error);
  }
};

// Loan endpoints
export const getAllLoans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '10', status, memberId } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause for filtering
    const whereClause: any = {};
    if (status) whereClause.status = status;
    if (memberId) whereClause.memberId = memberId;

    const { count, rows: loans } = await Loan.findAndCountAll({
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
      data: loans
    });
  } catch (error) {
    next(error);
  }
};

export const createLoan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { memberId, amount, purpose, term, interestRate } = req.body;

    // Validate required fields
    if (!memberId || !amount || !purpose || !term) {
      return next(new AppError('Please provide required fields', 400));
    }

    const newLoan = await Loan.create({
      memberId,
      amount: parseFloat(amount),
      purpose,
      term,
      interestRate: interestRate || 5.0, // Default interest rate
      status: 'pending',
      remainingBalance: parseFloat(amount),
      startDate: new Date(),
      endDate: new Date(Date.now() + term * 30 * 24 * 60 * 60 * 1000) // term in months
    });

    res.status(201).json({
      status: 'success',
      data: newLoan
    });
  } catch (error) {
    next(error);
  }
};

export const getLoanById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const loan = await Loan.findByPk(req.params.id, {
      include: [{
        model: Member,
        as: 'member',
        attributes: ['firstName', 'lastName']
      }]
    });
    
    if (!loan) {
      return next(new AppError('Loan not found', 404));
    }
    
    res.status(200).json({
      status: 'success',
      data: loan
    });
  } catch (error) {
    next(error);
  }
};

export const approveLoan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const loan = await Loan.findByPk(req.params.id);
    
    if (!loan) {
      return next(new AppError('Loan not found', 404));
    }

    if (loan.status !== 'pending') {
      return next(new AppError('Loan is not in pending status', 400));
    }

    await loan.update({
      status: 'approved',
      startDate: new Date()
    });

    res.status(200).json({
      status: 'success',
      data: loan
    });
  } catch (error) {
    next(error);
  }
};

export const rejectLoan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const loan = await Loan.findByPk(req.params.id);
    
    if (!loan) {
      return next(new AppError('Loan not found', 404));
    }

    if (loan.status !== 'pending') {
      return next(new AppError('Loan is not in pending status', 400));
    }

    await loan.update({
      status: 'rejected'
    });

    res.status(200).json({
      status: 'success',
      data: loan
    });
  } catch (error) {
    next(error);
  }
};

// Get user's loans (for authenticated users)
export const getUserLoans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;

    // Find the member for this user
    const member = await Member.findOne({ where: { userId } });
    if (!member) {
      return next(new AppError('Member not found for user', 404));
    }

    // Get all loans for this member
    const loans = await Loan.findAll({
      where: { memberId: member.id },
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      status: 'success',
      results: loans.length,
      data: loans
    });
  } catch (error) {
    next(error);
  }
};

// Routes
router.get('/transactions', authenticate, getAllTransactions);
router.post('/transactions', authenticate, createTransaction);
router.get('/transactions/:id', authenticate, getTransactionById);

router.get('/loans', authenticate, getAllLoans);
router.post('/loans', authenticate, createLoan);
router.get('/loans/:id', authenticate, getLoanById);
router.patch('/loans/:id/approve', authenticate, approveLoan);
router.patch('/loans/:id/reject', authenticate, rejectLoan);
router.get('/my-loans', authenticate, getUserLoans);

export default router;

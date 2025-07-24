import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import Loan from '../models/Loan';
import Member from '../models/Member';

export const getAllLoans = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const loans = await Loan.findAll({
      include: [{
        model: Member,
        as: 'member',
        attributes: ['firstName', 'lastName']
      }],
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json({ status: 'success', results: loans.length, data: loans });
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
    if (!loan) return next(new AppError('Loan not found', 404));
    res.status(200).json({ status: 'success', data: loan });
  } catch (error) {
    next(error);
  }
};

export const createLoan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { memberId, amount, purpose, term, interestRate } = req.body;
    
    if (!memberId || !amount || !purpose || !term) {
      return next(new AppError('Please provide required fields', 400));
    }

    const newLoan = await Loan.create({
      memberId,
      amount: parseFloat(amount),
      purpose,
      term,
      interestRate: interestRate || 5.0,
      status: 'pending',
      remainingBalance: parseFloat(amount),
      startDate: new Date(),
      endDate: new Date(Date.now() + term * 30 * 24 * 60 * 60 * 1000) // term in months
    });

    res.status(201).json({ status: 'success', data: newLoan });
  } catch (error) {
    next(error);
  }
};

export const updateLoan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount, purpose, term, status, interestRate } = req.body;
    
    const loan = await Loan.findByPk(req.params.id);
    if (!loan) return next(new AppError('Loan not found', 404));

    await loan.update({
      amount: amount || loan.amount,
      purpose: purpose || loan.purpose,
      term: term || loan.term,
      status: status || loan.status,
      interestRate: interestRate || loan.interestRate
    });

    res.status(200).json({ status: 'success', data: loan });
  } catch (error) {
    next(error);
  }
};

export const approveLoan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const loan = await Loan.findByPk(req.params.id);
    if (!loan) return next(new AppError('Loan not found', 404));

    if (loan.status !== 'pending') {
      return next(new AppError('Loan is not in pending status', 400));
    }

    await loan.update({
      status: 'approved',
      startDate: new Date()
    });

    res.status(200).json({ status: 'success', data: loan });
  } catch (error) {
    next(error);
  }
};

export const rejectLoan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const loan = await Loan.findByPk(req.params.id);
    if (!loan) return next(new AppError('Loan not found', 404));

    if (loan.status !== 'pending') {
      return next(new AppError('Loan is not in pending status', 400));
    }

    await loan.update({
      status: 'rejected'
    });

    res.status(200).json({ status: 'success', data: loan });
  } catch (error) {
    next(error);
  }
};

export default {
  getAllLoans,
  getLoanById,
  createLoan,
  updateLoan,
  approveLoan,
  rejectLoan,
};

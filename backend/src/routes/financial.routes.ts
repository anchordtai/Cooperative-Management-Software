import { permit } from '../middleware/permissions';
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, restrictTo } from '../middleware/auth';
import { financialScope, ownMember, pagination } from '../middleware/cooperative';
import { QueryTypes, Transaction as DatabaseTransaction } from 'sequelize';
import sequelize from '../config/database';
import Cooperative from '../models/Cooperative';
import Transaction from '../models/Transaction';
import { fixedLoanSchedule, money, positiveAmount, postEntry, requiredTransferReference, toMinorUnits } from '../services/finance';
import { recordAudit } from '../services/audit';
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
    const { cooperativeId, role, id } = req.user!;
    const { purpose } = req.body;
    const amount = positiveAmount(req.body.amount);
    const term = Number(req.body.term);
    if (typeof purpose !== 'string' || !purpose.trim() || purpose.length > 255 ||
      !['string', 'number'].includes(typeof req.body.term) || !Number.isInteger(term) || term < 1 || term > 120) {
      throw new AppError('Enter an amount, purpose and loan term from 1 to 120 months', 400);
    }
    const member = role === 'member' ? await ownMember(req) : await Member.findOne({
      where: { cooperativeId, id: req.body.memberId ?? null, status: 'active' }
    });
    if (!member) throw new AppError('Active member not found', 404);

    const settings = await Cooperative.findByPk(cooperativeId);
    const rate = settings?.settings.loanRate;
    if (rate === undefined || rate === null) throw new AppError('The cooperative has not configured a loan rate', 409);
    if (String(req.body.agreedRate) !== String(rate)) {
      throw new AppError('Review the current interest rate and confirm the application', 409);
    }
    fixedLoanSchedule(amount, toMinorUnits(rate), term, new Date());

    const loan = await Loan.create({
      cooperativeId, memberId: member.id, amount: money(amount), purpose: purpose.trim(), term, interestRate: rate,
      status: 'pending', remainingBalance: 0, startDate: null, endDate: null, requestedBy: id
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
    const schedule = await installments(loan.cooperativeId!, loan.id);
    res.json({ status: 'success', data: loan, schedule });
  } catch (error) {
    next(error);
  }
};

const decideLoan = (status: 'approved' | 'rejected') => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cooperativeId, id } = req.user!;
    const loan = await sequelize.transaction(async transaction => {
      const row = await lockedLoan(cooperativeId, req.params.id, transaction);
      if (row.status !== 'pending') throw new AppError('Only pending loans can be reviewed', 409);
      if (row.requestedBy === id) throw new AppError('Another officer must review this application', 409);
      await row.update({ status, decidedBy: id }, { transaction });
      await recordAudit(transaction, cooperativeId, id, `loan.${status}`, row.id);
      return row;
    });
    res.json({ status: 'success', data: loan });
  } catch (error) {
    next(error);
  }
};

interface Installment {
  number: number;
  dueOn: string;
  principal: string;
  interest: string;
  principalPaid: string;
  interestPaid: string;
}

async function installments(cooperativeId: string, loanId: string, transaction?: DatabaseTransaction) {
  return sequelize.query<Installment>(`
    SELECT "number", "dueOn", principal, interest, "principalPaid", "interestPaid" FROM "LoanInstallments"
    WHERE "cooperativeId" = :cooperativeId AND "loanId" = :loanId ORDER BY "number"
  `, { type: QueryTypes.SELECT, replacements: { cooperativeId, loanId }, transaction });
}

async function lockedLoan(cooperativeId: string, id: string, transaction: DatabaseTransaction) {
  const loan = await Loan.findOne({ where: { cooperativeId, id }, transaction, lock: transaction.LOCK.UPDATE });
  if (!loan) throw new AppError('Loan not found', 404);
  return loan;
}

const loanPolicy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cooperative = await Cooperative.findByPk(req.user!.cooperativeId);
    res.json({ data: { loanRate: cooperative?.settings.loanRate ?? null } });
  } catch (error) {
    next(error);
  }
};

const disburseLoan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cooperativeId, id } = req.user!;
    const externalReference = requiredTransferReference(req.body.reference);
    const loan = await sequelize.transaction(async transaction => {
      const account = await lockedLoan(cooperativeId, req.params.id, transaction);
      if (account.status !== 'approved') throw new AppError('Only an approved loan can be disbursed', 409);
      const activeMember = await Member.findOne({
        where: { id: account.memberId, cooperativeId, status: 'active' }, transaction, lock: transaction.LOCK.UPDATE
      });
      if (!activeMember) throw new AppError('Member is inactive', 409);

      const principal = positiveAmount(account.amount);
      const start = new Date();
      const schedule = fixedLoanSchedule(principal, toMinorUnits(account.interestRate), account.term, start);
      const outstanding = schedule.reduce((sum, row) => sum + row.principal + row.interest, 0);
      const rows = schedule.map(row => ({
        ...row, principal: money(row.principal), interest: money(row.interest)
      }));
      await sequelize.query(`
        INSERT INTO "LoanInstallments" ("cooperativeId", "loanId", "number", "dueOn", principal, interest)
        SELECT :cooperativeId, :loanId, "number", "dueOn", principal, interest
        FROM jsonb_to_recordset(CAST(:rows AS jsonb)) AS schedule("number" integer, "dueOn" date, principal numeric, interest numeric)
      `, { replacements: { cooperativeId, loanId: account.id, rows: JSON.stringify(rows) }, transaction });

      const entry = await Transaction.create({
        cooperativeId, memberId: account.memberId, loanId: account.id, type: 'loan',
        amount: money(principal), status: 'completed', description: `Loan disbursement • ${externalReference}`, handledBy: id, externalReference
      }, { transaction });
      await postEntry(transaction, cooperativeId, entry.id, 1, 'loan_principal', 'cash', principal);
      await recordAudit(transaction, cooperativeId, id, 'loan.disbursed', account.id, { transactionId: entry.id });
      return account.update({
        status: 'active', remainingBalance: money(outstanding), startDate: start,
        endDate: new Date(schedule[schedule.length - 1].dueOn)
      }, { transaction });
    });
    res.json({ status: 'success', data: loan });
  } catch (error) {
    next(error);
  }
};

const repayLoan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cooperativeId, id } = req.user!;
    const amount = positiveAmount(req.body.amount);
    const externalReference = requiredTransferReference(req.body.reference);
    const result = await sequelize.transaction(async transaction => {
      const loan = await lockedLoan(cooperativeId, req.params.id, transaction);
      const description = `Loan repayment • ${externalReference}`;
      const duplicate = await Transaction.findOne({
        where: { cooperativeId, loanId: loan.id, type: 'repayment', externalReference }, transaction
      });
      if (duplicate) throw new AppError('This repayment reference has already been recorded', 409);
      if (loan.status !== 'active') throw new AppError('This loan is not active', 409);
      const outstanding = toMinorUnits(loan.remainingBalance);
      if (amount > outstanding) throw new AppError('Payment exceeds outstanding amount', 400);

      let remaining = amount;
      let interestPaid = 0;
      for (const row of await installments(cooperativeId, loan.id, transaction)) {
        if (!remaining) break;
        const priorPrincipal = toMinorUnits(row.principalPaid);
        const priorInterest = toMinorUnits(row.interestPaid);
        const interest = Math.min(remaining, toMinorUnits(row.interest) - priorInterest);
        const principal = Math.min(remaining - interest, toMinorUnits(row.principal) - priorPrincipal);
        if (!interest && !principal) continue;
        await sequelize.query(`
          UPDATE "LoanInstallments" SET "principalPaid" = :principal, "interestPaid" = :interest
          WHERE "cooperativeId" = :cooperativeId AND "loanId" = :loanId AND "number" = :number
        `, { replacements: {
          cooperativeId, loanId: loan.id, number: row.number, principal: money(priorPrincipal + principal),
          interest: money(priorInterest + interest)
        }, transaction });
        interestPaid += interest;
        remaining -= principal + interest;
      }
      if (remaining) throw new AppError('Loan schedule does not reconcile with the balance', 409);

      const entry = await Transaction.create({
        cooperativeId, memberId: loan.memberId, loanId: loan.id, type: 'repayment',
        amount: money(amount), description, status: 'completed', handledBy: id, externalReference
      }, { transaction });
      await postEntry(transaction, cooperativeId, entry.id, 1, 'cash', 'loan_principal', amount - interestPaid);
      await postEntry(transaction, cooperativeId, entry.id, 2, 'cash', 'interest_income', interestPaid);

      await loan.update({ remainingBalance: money(outstanding - amount),
        status: outstanding === amount ? 'completed' : 'active' }, { transaction });
      await recordAudit(transaction, cooperativeId, id, 'loan.repayment', loan.id, { transactionId: entry.id });
      return { loan, entry };
    });
    res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

const router = Router();
router.use(authenticate);
router.get('/transactions', permit('finance.read', true), getAllTransactions);
router.get('/transactions/:id', permit('finance.read', true), getTransactionById);
router.post('/transactions', permit('savings.deposit'), createTransaction);
router.get('/loans', permit('finance.read', true), getAllLoans);
router.get('/loans/policy', loanPolicy);
router.get('/loans/my', restrictTo('member'), getAllLoans);
router.get('/my-loans', restrictTo('member'), getAllLoans);
router.get('/loans/:id', permit('finance.read', true), getLoanById);
router.post('/loans', permit('loans.submit', true), createLoan);
router.patch('/loans/:id/approve', permit('loans.decide'), decideLoan('approved'));
router.patch('/loans/:id/reject', permit('loans.decide'), decideLoan('rejected'));
router.post('/loans/:id/disburse', permit('loans.post'), disburseLoan);
router.post('/loans/:id/repayments', permit('loans.post'), repayLoan);

export default router;

import { Transaction as DatabaseTransaction } from 'sequelize';
import sequelize from '../config/database';
import { AppError } from '../middleware/errorHandler';

export function toMinorUnits(value: unknown) {
  if (typeof value !== 'number' && typeof value !== 'string') throw new AppError('Enter a valid amount', 400);
  const [whole, fraction = ''] = String(value).split('.');
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(String(value))) {
    throw new AppError('Enter an amount with up to two decimal places', 400);
  }
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function money(cents: number) {
  return (cents / 100).toFixed(2);
}

export function positiveAmount(value: unknown) {
  const cents = toMinorUnits(value);
  if (!cents) throw new AppError('Amount must be greater than zero', 400);
  return cents;
}

export function requiredTransferReference(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 160) {
    throw new AppError('Enter the transfer reference', 400);
  }
  return value.trim();
}

type Account = 'cash' | 'member_savings' | 'loan_principal' | 'interest_income';

export async function postEntry(
  transaction: DatabaseTransaction, cooperativeId: string, transactionId: string, sequence: number,
  debitAccount: Account, creditAccount: Account, cents: number
) {
  if (cents === 0) return;
  await sequelize.query(`
    INSERT INTO "FinancialPostings"
      ("cooperativeId", "transactionId", "sequence", "debitAccount", "creditAccount", "amount")
    VALUES (:cooperativeId, :transactionId, :sequence, :debitAccount, :creditAccount, :amount)
  `, { replacements: { cooperativeId, transactionId, sequence, debitAccount, creditAccount, amount: money(cents) }, transaction });
}

export function fixedLoanSchedule(amount: number, rateInBasisPoints: number, term: number, start: Date) {
  if (amount < term) throw new AppError('The amount is too small for the loan term', 400);
  // Flat interest per year is prorated for the agreed term and rounded once to a kobo.
  const roundedInterest = Math.round((amount % 120000) * rateInBasisPoints * term / 120000);
  const interest = Math.floor(amount / 120000) * rateInBasisPoints * term + roundedInterest;
  if (amount + interest > 9999999999) throw new AppError('Loan total exceeds the supported amount', 400);
  const split = (total: number, index: number) => Math.floor(total / term) + (index < total % term ? 1 : 0);

  return Array.from({ length: term }, (_, index) => {
    const number = index + 1;
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + number, 1));
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(start.getUTCDate(), lastDay));
    return { number, dueOn: date.toISOString().slice(0, 10), principal: split(amount, index), interest: split(interest, index) };
  });
}

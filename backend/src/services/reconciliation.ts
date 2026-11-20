import { QueryTypes } from 'sequelize';
import sequelize from '../config/database';
import { AppError } from '../middleware/errorHandler';

const pageSize = 50;
const day = 86400000;
const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' });

function dateValue(value: unknown) {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return NaN;
  const timestamp = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : NaN;
}

export async function reconciliationReport(cooperativeId: string, from: unknown, to: unknown, page: unknown = '1') {
  const start = dateValue(from);
  const end = dateValue(to);
  const today = localDate.format(new Date());
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start >= 366 * day || String(to) > today) {
    throw new AppError('Choose valid dates ending today or earlier and covering up to 366 days.', 400);
  }
  if (typeof page !== 'string' || !/^[1-9]\d{0,5}$/.test(page)) {
    throw new AppError('Choose a valid report page.', 400);
  }

  // A single statement keeps all checks on the same PostgreSQL snapshot.
  const [result] = await sequelize.query(`
    WITH bounds AS (
      SELECT CAST(:from AS date)::timestamp AT TIME ZONE 'Africa/Lagos' AS starts_at,
        (CAST(:to AS date) + 1)::timestamp AT TIME ZONE 'Africa/Lagos' AS ends_at
    ), transactions AS (
      SELECT id, "memberId", "loanId", type, amount, "externalReference",
        CASE WHEN type = 'withdrawal' THEN "updatedAt" ELSE "createdAt" END AS posted_at
      FROM "Transactions"
      WHERE "cooperativeId" = :cooperativeId AND status = 'completed'
        AND type IN ('deposit', 'withdrawal', 'loan', 'repayment')
        AND (CASE WHEN type = 'withdrawal' THEN "updatedAt" ELSE "createdAt" END) <= now()
    ), period_transactions AS (
      SELECT t.* FROM transactions t CROSS JOIN bounds
      WHERE posted_at >= starts_at AND posted_at < ends_at
    ), movement AS (
      SELECT
        coalesce(sum(CASE type WHEN 'deposit' THEN amount WHEN 'withdrawal' THEN -amount ELSE 0 END)
          FILTER (WHERE posted_at < starts_at), 0) AS opening,
        coalesce(sum(amount) FILTER (WHERE type = 'deposit' AND posted_at >= starts_at), 0) AS deposits,
        coalesce(sum(amount) FILTER (WHERE type = 'withdrawal' AND posted_at >= starts_at), 0) AS withdrawals,
        coalesce(sum(amount) FILTER (WHERE type = 'loan' AND posted_at >= starts_at), 0) AS disbursements,
        coalesce(sum(amount) FILTER (WHERE type = 'repayment' AND posted_at >= starts_at), 0) AS repayments,
        count(*) FILTER (WHERE posted_at >= starts_at)::int AS transaction_count
      FROM transactions CROSS JOIN bounds WHERE posted_at < ends_at
    ), period_postings AS (
      SELECT t.id, t."memberId", t."loanId", t.type, t.amount, t."externalReference", t.posted_at,
        coalesce(sum(p.amount), 0) AS posted, count(p."sequence") AS lines,
        count(*) FILTER (WHERE p."sequence" IS NOT NULL AND NOT (
          (t.type = 'deposit' AND p."debitAccount" IN ('cash', 'payment_clearing') AND p."creditAccount" = 'member_savings') OR
          (t.type = 'withdrawal' AND p."debitAccount" = 'member_savings' AND p."creditAccount" = 'cash') OR
          (t.type = 'loan' AND p."debitAccount" = 'loan_principal' AND p."creditAccount" = 'cash') OR
          (t.type = 'repayment' AND p."debitAccount" = 'cash' AND p."creditAccount" IN ('loan_principal', 'interest_income'))
        )) AS unexpected_accounts,
        count(DISTINCT p."creditAccount") AS credit_accounts
      FROM period_transactions t
      LEFT JOIN "FinancialPostings" p ON p."cooperativeId" = :cooperativeId AND p."transactionId" = t.id
      GROUP BY t.id, t."memberId", t."loanId", t.type, t.amount, t."externalReference", t.posted_at
    ), member_movements AS (
      SELECT "memberId", sum(CASE WHEN type = 'deposit' THEN amount ELSE -amount END) AS expected
      FROM transactions WHERE type IN ('deposit', 'withdrawal') GROUP BY "memberId"
    ), savings AS (
      SELECT m.id, coalesce(m.savings, 0) AS recorded, coalesce(x.expected, 0) AS expected
      FROM "Members" m LEFT JOIN member_movements x ON x."memberId" = m.id
      WHERE m."cooperativeId" = :cooperativeId
    ), installments AS (
      SELECT "loanId", sum(principal - "principalPaid") AS principal,
        sum(interest - "interestPaid") AS interest, sum("interestPaid") AS interest_paid
      FROM "LoanInstallments" WHERE "cooperativeId" = :cooperativeId GROUP BY "loanId"
    ), loan_postings AS (
      SELECT t."loanId",
        sum(CASE WHEN p."debitAccount" = 'loan_principal' THEN p.amount
                 WHEN p."creditAccount" = 'loan_principal' THEN -p.amount ELSE 0 END) AS principal,
        sum(p.amount) FILTER (WHERE t.type = 'repayment' AND p."creditAccount" = 'interest_income') AS interest_paid
      FROM transactions t JOIN "FinancialPostings" p ON p."cooperativeId" = :cooperativeId AND p."transactionId" = t.id
      WHERE t.type IN ('loan', 'repayment') AND t."loanId" IS NOT NULL
      GROUP BY t."loanId"
    ), loans AS (
      SELECT l.id, l."memberId", coalesce(l."remainingBalance", 0) AS recorded,
        i.principal, i.interest, i.interest_paid,
        coalesce(p.principal, 0) AS posted_principal, coalesce(p.interest_paid, 0) AS posted_interest
      FROM "Loans" l LEFT JOIN installments i ON i."loanId" = l.id
      LEFT JOIN loan_postings p ON p."loanId" = l.id
      WHERE l."cooperativeId" = :cooperativeId AND l.status IN ('active', 'completed')
    ), exceptions AS (
      SELECT CASE WHEN lines = 0 THEN 'missing_postings'
        WHEN posted <> amount THEN 'posting_amount'
        WHEN unexpected_accounts > 0 OR (type <> 'repayment' AND lines <> 1)
          OR (type = 'repayment' AND lines <> credit_accounts) THEN 'posting_accounts'
        ELSE 'missing_loan_reference' END AS reason,
        id AS record_id, "memberId" AS member_id, "externalReference" AS reference,
        amount AS expected, posted AS recorded, posted_at AS occurred_at
      FROM period_postings
      WHERE lines = 0 OR posted <> amount OR unexpected_accounts > 0
        OR (type <> 'repayment' AND lines <> 1) OR (type = 'repayment' AND lines <> credit_accounts)
        OR (type IN ('loan', 'repayment') AND "loanId" IS NULL)
      UNION ALL
      SELECT 'savings_balance', id, id, NULL, expected, recorded, NULL FROM savings WHERE expected <> recorded
      UNION ALL
      SELECT 'missing_loan_schedule', id, "memberId", NULL, NULL, recorded, NULL FROM loans WHERE principal IS NULL
      UNION ALL
      SELECT 'loan_balance', id, "memberId", NULL, principal + interest, recorded, NULL
      FROM loans WHERE principal + interest <> recorded
      UNION ALL
      SELECT 'loan_principal', id, "memberId", NULL, principal, posted_principal, NULL
      FROM loans WHERE principal <> posted_principal
      UNION ALL
      SELECT 'loan_interest', id, "memberId", NULL, interest_paid, posted_interest, NULL
      FROM loans WHERE interest_paid <> posted_interest
    ), page AS (
      SELECT reason, record_id AS "recordId", member_id AS "memberId", reference,
        round(expected, 2)::text AS expected, round(recorded, 2)::text AS recorded, occurred_at AS "occurredAt"
      FROM exceptions ORDER BY occurred_at DESC NULLS LAST, record_id, reason
      LIMIT :limit OFFSET :offset
    )
    SELECT
      now() AS "asOf",
      round(opening, 2)::text AS "openingSavings",
      round(deposits, 2)::text AS deposits,
      round(withdrawals, 2)::text AS withdrawals,
      round(opening + deposits - withdrawals, 2)::text AS "closingSavings",
      round(disbursements, 2)::text AS disbursements,
      round(repayments, 2)::text AS repayments,
      transaction_count AS "transactionCount",
      (SELECT round(coalesce(sum(recorded), 0), 2)::text FROM savings) AS "currentSavings",
      (SELECT round(coalesce(sum(recorded), 0), 2)::text FROM loans) AS "currentLoans",
      (SELECT count(*)::int FROM exceptions) AS "issueCount",
      coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY "occurredAt" DESC NULLS LAST, "recordId", reason) FROM page), '[]'::jsonb) AS issues
    FROM movement
  `, { type: QueryTypes.SELECT, replacements: { cooperativeId, from, to, limit: pageSize, offset: (Number(page) - 1) * pageSize } });
  return { ...result, from, to, page: Number(page), pageSize };
}

import { QueryTypes } from 'sequelize';
import sequelize from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { money, toMinorUnits } from './finance';
import { reportPeriod, dateValue } from './reconciliation';

type Direction = 'credit' | 'debit';
interface Entry { date: string; reference: string | null; direction: Direction; amount: string }
interface RecordedEntry extends Entry { id: string; type: string }
interface StatementEntry extends Entry { line: number; reference: string }

const maxRows = 250;
const maxBytes = 28000;
const field = '("(?:[^"]|"")*"|[^",]*)';
const csvRow = new RegExp('^' + [field, field, field, field].join(',') + '$');
const fields = (row: string) => csvRow.exec(row)?.slice(1).map(value =>
  (value.startsWith('"') ? value.slice(1, -1).replace(/""/g, '"') : value).trim());

function parseStatement(csv: unknown, from: string, to: string) {
  if (typeof csv !== 'string' || Buffer.byteLength(csv) > maxBytes) {
    throw new AppError('Upload a UTF-8 CSV of up to 28,000 bytes.', 400);
  }
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).flatMap((raw, index) =>
    raw.trim() ? [{ raw, line: index + 1 }] : []);
  if (!lines[0] || fields(lines[0].raw)?.join(',').toLowerCase() !== 'date,reference,direction,amount' || lines.length < 2 || lines.length > maxRows + 1) {
    throw new AppError('Use the template header date,reference,direction,amount and include 1 to 250 entries.', 400);
  }
  return lines.slice(1).map(({ raw, line }): StatementEntry => {
    const record = fields(raw);
    if (!record) throw new AppError(`CSV line ${line} must have four fields.`, 400);
    const [date, reference, direction, amount] = record;
    if (!Number.isFinite(dateValue(date)) || date < from || date > to) {
      throw new AppError(`CSV line ${line} must use a YYYY-MM-DD date in the selected period.`, 400);
    }
    if (!reference || reference.length > 160 || /[\u0000-\u001f\u007f]/.test(reference)) {
      throw new AppError(`CSV line ${line} must have a valid reference of up to 160 characters.`, 400);
    }
    const normalizedDirection = direction.toLowerCase();
    if (normalizedDirection !== 'credit' && normalizedDirection !== 'debit') {
      throw new AppError(`CSV line ${line} must use credit or debit as its direction.`, 400);
    }
    const validAmount = /^\d{1,8}(?:\.\d{1,2})?$/.test(amount);
    const minor = validAmount ? toMinorUnits(amount) : 0;
    if (minor <= 0) {
      throw new AppError(`CSV line ${line} must have a positive NGN amount with up to two decimal places.`, 400);
    }
    return { line, date, reference, direction: normalizedDirection, amount: money(minor) };
  });
}

function groupReferences<T extends Entry>(entries: T[]) {
  const grouped = new Map<string, T[]>();
  for (const entry of entries) {
    const key = entry.reference?.trim().toLowerCase();
    if (!key) continue;
    const group = grouped.get(key);
    if (group) group.push(entry);
    else grouped.set(key, [entry]);
  }
  return grouped;
}

function compare(statement: StatementEntry[], recorded: RecordedEntry[]) {
  const bankRefs = groupReferences(statement);
  const recordRefs = groupReferences(recorded);
  const rows = statement.map(entry => {
    const reference = entry.reference.toLowerCase();
    const candidates = recordRefs.get(reference) || [];
    const record = candidates.length === 1 ? candidates[0] : null;
    const duplicate = (bankRefs.get(reference)?.length ?? 0) > 1 || candidates.length > 1;
    let status = 'matched';
    if (duplicate) status = 'duplicate_reference';
    else if (!record) status = 'statement_only';
    else if (entry.direction !== record.direction) status = 'direction_mismatch';
    else if (entry.amount !== record.amount) status = 'amount_mismatch';
    else if (entry.date !== record.date) status = 'date_mismatch';
    return { status, statement: entry, recorded: record, candidateCount: candidates.length };
  });
  const recordOnly = recorded.filter(entry => !entry.reference || !bankRefs.has(entry.reference.trim().toLowerCase()))
    .map(entry => ({ status: 'record_only', statement: null, recorded: entry, candidateCount: 1 }));
  return [...rows, ...recordOnly];
}

export async function matchStatement(cooperativeId: string, from: unknown, to: unknown, csv: unknown) {
  const period = reportPeriod(from, to);
  const statement = parseStatement(csv, period.from, period.to);
  const recorded = await sequelize.query<RecordedEntry>(`
    WITH activity AS (
      SELECT t.id, t.type, t."externalReference", t.amount,
        CASE WHEN t.type = 'withdrawal' THEN t."updatedAt" ELSE t."createdAt" END AS posted_at
      FROM "Transactions" t
      WHERE t."cooperativeId" = :cooperativeId AND t.status = 'completed'
        AND t.type IN ('deposit', 'withdrawal', 'loan', 'repayment')
        AND NOT EXISTS (
          SELECT 1 FROM "PaymentIntents" p WHERE p."cooperativeId" = t."cooperativeId"
            AND p."transactionId" = t.id AND p.provider = 'paystack_test'
        )
        AND NOT EXISTS (
          SELECT 1 FROM "FinancialPostings" p WHERE p."cooperativeId" = t."cooperativeId" AND p."transactionId" = t.id
            AND (p."debitAccount" = 'payment_clearing' OR p."creditAccount" = 'payment_clearing')
        )
    )
    SELECT id, type, "externalReference" AS reference, round(amount, 2)::text AS amount,
      CASE WHEN type IN ('deposit', 'repayment') THEN 'credit' ELSE 'debit' END AS direction,
      to_char(timezone('Africa/Lagos', posted_at), 'YYYY-MM-DD') AS date
    FROM activity
    WHERE posted_at >= CAST(:from AS date)::timestamp AT TIME ZONE 'Africa/Lagos'
      AND posted_at < (CAST(:to AS date) + 1)::timestamp AT TIME ZONE 'Africa/Lagos'
      AND posted_at <= now()
    ORDER BY posted_at, id LIMIT 2001
  `, { type: QueryTypes.SELECT, replacements: { cooperativeId, ...period } });
  if (recorded.length > 2000) throw new AppError('Choose a shorter period with at most 2,000 recorded transactions.', 400);
  const rows = compare(statement, recorded);
  const matched = rows.filter(row => row.status === 'matched').length;
  return { ...period, statementCount: statement.length, recordedCount: recorded.length, matched, rows };
}

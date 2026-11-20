import { createHash, randomUUID } from 'node:crypto';
import { Router } from 'express';
import sequelize from '../config/database';
import { authenticate, restrictTo } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { requireSubscription } from '../middleware/subscription';
import Member from '../models/Member';
import { capacity, checkCapacity, lockCooperative, select } from '../services/subscriptions';

export const memberImport = Router();
memberImport.use(authenticate, restrictTo('admin'), requireSubscription);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const headers = ['firstName', 'lastName', 'email', 'phone', 'address'] as const;

function parse(rows: unknown) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 100) throw new AppError('Submit 1 to 100 rows per batch.', 400);
  return rows.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new AppError('Invalid member import row.', 400);
    const data = Object.fromEntries(headers.map(key => [key, typeof row[key] === 'string' ? row[key].trim() : ''])) as Record<typeof headers[number], string>;
    data.email = data.email.toLowerCase();
    const normalizedPhone = data.phone.replace(/[\s()-]/g, '');
    const valid = headers.every(key => data[key] && data[key].length <= (key === 'address' ? 500 : 160) && !/[\u0000-\u001f\u007f]/.test(data[key])) &&
      emailPattern.test(data.email) && /^\+?\d{7,15}$/.test(normalizedPhone);
    return { line: index + 2, valid, data, normalizedPhone };
  });
}

async function assess(cooperativeId: string, rows: ReturnType<typeof parse>, transaction?: Parameters<typeof select>[2]) {
  const valid = rows.filter(row => row.valid);
  const existing = valid.length ? await select<{ email: string; phone: string }>(`
    SELECT lower(trim(email)) AS email, regexp_replace(phone, '[[:space:]()-]', '', 'g') AS phone FROM "Members"
    WHERE "cooperativeId" = :cooperativeId AND (lower(trim(email)) IN (:emails)
      OR regexp_replace(phone, '[[:space:]()-]', '', 'g') IN (:phones))
  `, { cooperativeId, emails: valid.map(r => r.data.email), phones: valid.map(r => r.normalizedPhone) }, transaction) : [];
  const email = new Set(existing.map(row => row.email));
  const phone = new Set(existing.map(row => row.phone));
  return rows.map(row => {
    const status = !row.valid ? 'invalid' : email.has(row.data.email) || phone.has(row.normalizedPhone) ? 'duplicate' : 'valid';
    if (row.valid) {
      email.add(row.data.email);
      phone.add(row.normalizedPhone);
    }
    return { ...row, status };
  });
}

memberImport.post('/preview', async (req, res, next) => {
  try {
    const cooperativeId = req.user!.cooperativeId;
    const [rows, state] = await Promise.all([assess(cooperativeId, parse(req.body.rows)), capacity(cooperativeId)]);
    res.json({ data: { remaining: state.remaining, rows: rows.map(({ line, status }) => ({ line, status })) } });
  } catch (error) { next(error); }
});

memberImport.post('/confirm', async (req, res, next) => {
  try {
    const { requestId, acceptPartial } = req.body;
    if (typeof requestId !== 'string' || !uuid.test(requestId) || typeof acceptPartial !== 'boolean') {
      throw new AppError('Submit a valid import confirmation.', 400);
    }
    const input = parse(req.body.rows);
    const digest = createHash('sha256').update(JSON.stringify({ input, acceptPartial })).digest('hex');
    const { cooperativeId, id: actorId } = req.user!;
    const result = await sequelize.transaction(async transaction => {
      await lockCooperative(cooperativeId, transaction);
      const [existing] = await select<{ digest: string; result: object }>(`
        SELECT digest,result FROM "MemberImportHistory" WHERE "cooperativeId" = :cooperativeId AND "requestId" = :requestId
      `, { cooperativeId, requestId }, transaction);
      if (existing) {
        if (existing.digest !== digest) throw new AppError('This import ID was used for different rows.', 409);
        return existing.result;
      }
      const rows = await assess(cooperativeId, input, transaction);
      const state = await capacity(cooperativeId, transaction);
      if (!state.allowed) throw new AppError('Activate a subscription before importing members.', 402);
      const ready = rows.filter(row => row.status === 'valid');
      if (state.remaining !== null && ready.length > state.remaining && !acceptPartial) {
        throw new AppError(`Only ${state.remaining} new members fit. Confirm a partial import or choose a larger plan.`, 409);
      }
      const chosen = ready.slice(0, state.remaining ?? ready.length);
      await checkCapacity(cooperativeId, chosen.length, transaction);
      const selected = new Set(chosen.map(row => row.line));
      await Member.bulkCreate(chosen.map(row => ({ ...row.data, cooperativeId,
        membershipNumber: 'EC-' + randomUUID(), status: 'inactive' })), { transaction, validate: true });
      const result = { processed: rows.length, created: chosen.length, remaining: state.remaining === null ? null : state.remaining - chosen.length,
        rows: rows.map(({ line, status }) => ({ line, status: status === 'valid' ? selected.has(line) ? 'created' : 'capacity' : status })) };
      await sequelize.query(`
        INSERT INTO "MemberImportHistory" ("cooperativeId","actorId","requestId",digest,result)
        VALUES (:cooperativeId,:actorId,:requestId,:digest,CAST(:result AS jsonb))
      `, { replacements: { cooperativeId, actorId, requestId, digest, result: JSON.stringify(result) }, transaction });
      return result;
    });
    res.status(201).json({ data: result });
  } catch (error) { next(error); }
});

memberImport.get('/history', async (req, res, next) => {
  try {
    res.json({ data: await select(`
      SELECT id,result,"createdAt" FROM "MemberImportHistory" WHERE "cooperativeId" = :cooperativeId ORDER BY id DESC LIMIT 50
    `, { cooperativeId: req.user!.cooperativeId }) });
  } catch (error) { next(error); }
});

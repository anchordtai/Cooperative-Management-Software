import { QueryTypes, Transaction } from 'sequelize';
import sequelize from '../config/database';
import Cooperative from '../models/Cooperative';
import Member from '../models/Member';
import { AppError } from '../middleware/errorHandler';

export interface Plan {
  id: number; slug: string; name: string; description: string; maximumMembers: number | null;
  monthlyMinor: string | null; annualMinor: string | null; currency: string; features: string[];
  active: boolean; recommended: boolean; customPricing: boolean; displayOrder: number; trialDays: number; graceDays: number;
}
interface Term {
  planId: number; planName: string; maximumMembers: number | null; cycle: string | null; trial: boolean;
  startsAt: Date; endsAt: Date; revision: number; status: 'active' | 'trial' | 'grace' | 'expired' | 'cancelled';
}
export const subscriptionEnforced = () => process.env.SAAS_ENFORCE_SUBSCRIPTIONS === 'true';
export const select = <T extends object>(sql: string, replacements: Record<string, any> = {}, transaction?: Transaction) =>
  sequelize.query<T>(sql, { replacements, transaction, type: QueryTypes.SELECT });

export const listPlans = (owner = false, transaction?: Transaction) => select<Plan>(
  `SELECT * FROM "SubscriptionPlans" ${owner ? '' : 'WHERE active'} ORDER BY "displayOrder", id`, {}, transaction
);

export const termStatus = `CASE
      WHEN s."endsAt" > statement_timestamp() THEN CASE WHEN s.trial THEN 'trial' ELSE 'active' END
      WHEN s."cancelledAt" IS NOT NULL THEN 'cancelled'
      WHEN NOT s.trial AND s."endsAt" + make_interval(days => s."graceDays") > statement_timestamp() THEN 'grace'
      ELSE 'expired' END`;

export async function currentTerm(cooperativeId: string, transaction?: Transaction) {
  const [term] = await select<Term>(`
    SELECT s.*, p.name AS "planName", ${termStatus} AS status
    FROM "CooperativeSubscriptions" s JOIN "SubscriptionPlans" p ON p.id = s."planId"
    WHERE s."cooperativeId" = :cooperativeId
  `, { cooperativeId }, transaction);
  return term || null;
}

export const hasSubscriptionAccess = (term: Term | null) => Boolean(term && ['active', 'trial', 'grace'].includes(term.status));

export async function lockCooperative(cooperativeId: string, transaction: Transaction) {
  const cooperative = await Cooperative.findByPk(cooperativeId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!cooperative || cooperative.suspendedAt) throw new AppError('This cooperative is unavailable.', 403);
  return cooperative;
}

export async function capacity(cooperativeId: string, transaction?: Transaction) {
  const term = await currentTerm(cooperativeId, transaction);
  const used = await Member.count({ where: { cooperativeId }, transaction });
  const maximum = hasSubscriptionAccess(term) ? term!.maximumMembers : null;
  const allowed = hasSubscriptionAccess(term) || !subscriptionEnforced();
  return { term, used, maximum, allowed, remaining: !allowed ? 0 : maximum === null ? null : Math.max(0, maximum - used) };
}

export async function checkCapacity(cooperativeId: string, adding: number, transaction: Transaction) {
  await lockCooperative(cooperativeId, transaction);
  const state = await capacity(cooperativeId, transaction);
  if (!state.allowed) throw new AppError('Activate a subscription or authorised trial in Billing.', 402);
  if (state.remaining !== null && adding > state.remaining) {
    throw new AppError(`This cooperative has room for ${state.remaining} additional members. Choose a larger plan in Billing.`, 409);
  }
  return state;
}

export async function billingEvent(action: string, actorId: string, cooperativeId: string | null,
  reference: string | null, details: object, transaction: Transaction) {
  await sequelize.query(`
    INSERT INTO "SubscriptionHistory" ("actorId","cooperativeId",action,reference,details)
    VALUES (:actorId,:cooperativeId,:action,:reference,CAST(:details AS jsonb))
  `, { replacements: { actorId, cooperativeId, action, reference, details: JSON.stringify(details) }, transaction });
}

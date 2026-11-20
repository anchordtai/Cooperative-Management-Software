import { randomUUID } from 'node:crypto';
import sequelize from '../config/database';
import Member from '../models/Member';
import { AppError } from '../middleware/errorHandler';
import { availableGateways, Gateway, initialize, Mode, paymentMode, verifyGateway } from './billing-gateways';
import { enqueueBillingEmail } from './billing-notifications';
import { billingEvent, currentTerm, lockCooperative, Plan, select } from './subscriptions';

interface Payment {
  reference: string; cooperativeId: string; actorId: string; planId: number; planName: string; expectedRevision: number;
  maximumMembers: number | null; graceDays: number; cycle: 'monthly' | 'annual'; gateway: Gateway; mode: Mode;
  amountMinor: string; status: string;
}

export async function checkout(cooperativeId: string, actorId: string, email: string, input: Record<string, unknown>) {
  const { plan, cycle, gateway, expectedMinor } = input;
  if (typeof plan !== 'string' || !['monthly', 'annual'].includes(String(cycle)) ||
      (gateway !== 'paystack' && gateway !== 'flutterwave') || typeof expectedMinor !== 'string') {
    throw new AppError('Choose a plan, billing cycle and payment gateway.', 400);
  }
  if (!availableGateways().includes(gateway)) throw new AppError('This billing gateway is not configured.', 503);
  const reference = 'cs-sub-' + randomUUID();
  const amount = await sequelize.transaction(async transaction => {
    const cooperative = await lockCooperative(cooperativeId, transaction);
    const required = ['cooperativeType', 'address', 'state', 'country', 'email', 'phone'];
    if (!required.every(key => typeof cooperative.settings[key] === 'string' && String(cooperative.settings[key]).trim())) {
      throw new AppError('Save your cooperative profile before starting checkout.', 409);
    }
    const [p] = await select<Plan>('SELECT * FROM "SubscriptionPlans" WHERE slug = :plan AND active', { plan }, transaction);
    const price = cycle === 'annual' ? p?.annualMinor : p?.monthlyMinor;
    if (!p || p.customPricing || !price) throw new AppError('This plan and billing cycle have no published price.', 409);
    if (price !== expectedMinor) throw new AppError('Pricing has changed. Reload Billing and review the new amount.', 409);
    const used = await Member.count({ where: { cooperativeId }, transaction });
    if (p.maximumMembers !== null && used > p.maximumMembers) throw new AppError('Choose a plan that can hold your existing members.', 409);
    const term = await currentTerm(cooperativeId, transaction);
    if (term?.status === 'active' && term.planId !== p.id &&
        (p.maximumMembers ?? Infinity) <= (term.maximumMembers ?? Infinity)) {
      throw new AppError('Downgrades are available when your current paid term ends.', 409);
    }
    await sequelize.query(`
      INSERT INTO "SubscriptionPayments" (reference,"cooperativeId","actorId","planId","planName","maximumMembers",
        "graceDays","expectedRevision",cycle,gateway,mode,"amountMinor",currency)
      VALUES (:reference,:cooperativeId,:actorId,:planId,:name,:maximumMembers,:graceDays,:revision,:cycle,:gateway,:mode,:price,'NGN')
    `, { replacements: { reference, cooperativeId, actorId, planId: p.id, name: p.name, maximumMembers: p.maximumMembers,
      graceDays: p.graceDays, revision: term?.revision ?? 0, cycle, gateway, mode: paymentMode(), price }, transaction });
    await billingEvent('checkout.created', actorId, cooperativeId, reference, { plan, cycle }, transaction);
    return Number(price);
  });
  // Preserve attempts when a gateway times out: the remote request may still have succeeded.
  return { reference, url: await initialize(gateway, email, reference, amount) };
}

export async function settleCheckout(reference: string, cooperativeId?: string, gateway?: Gateway) {
  if (!/^cs-sub-[a-f0-9-]{36}$/.test(reference)) throw new AppError('Invalid billing reference.', 400);
  const [initial] = await select<Payment>(`
    SELECT * FROM "SubscriptionPayments" WHERE reference = :reference
      AND (:cooperativeId IS NULL OR "cooperativeId" = CAST(:cooperativeId AS uuid))
      AND (:gateway IS NULL OR gateway = :gateway)
  `, { reference, cooperativeId: cooperativeId ?? null, gateway: gateway ?? null });
  if (!initial) throw new AppError('Billing payment not found.', 404);
  if (initial.status === 'paid' || initial.status === 'review') return { status: initial.status };
  const verified = await verifyGateway(initial.gateway, reference, Number(initial.amountMinor), initial.mode);
  if (verified.status === 'pending') return { status: 'pending' };
  return sequelize.transaction(async transaction => {
    await lockCooperative(initial.cooperativeId, transaction);
    const [payment] = await select<Payment>('SELECT * FROM "SubscriptionPayments" WHERE reference = :reference FOR UPDATE', { reference }, transaction);
    if (payment.status === 'paid' || payment.status === 'review') return { status: payment.status };
    if (verified.status === 'failed') {
      if (payment.status !== 'failed') {
        await sequelize.query(`UPDATE "SubscriptionPayments" SET status = 'failed' WHERE reference = :reference`,
          { replacements: { reference }, transaction });
        await billingEvent('payment.failed', payment.actorId, payment.cooperativeId, reference, {}, transaction);
        await enqueueBillingEmail('failed:' + reference, payment.cooperativeId, payment.actorId,
          'Co-opSphere payment update', `Payment attempt ${reference} was unsuccessful. Review your billing history before starting a new checkout.`, transaction);
      }
      return { status: 'failed' };
    }
    await sequelize.query(`DELETE FROM "BillingNotifications"
      WHERE key = :key AND "sentAt" IS NULL`, { replacements: { key: 'failed:' + reference }, transaction });
    const term = await currentTerm(payment.cooperativeId, transaction);
    const members = await Member.count({ where: { cooperativeId: payment.cooperativeId }, transaction });
    if ((term?.revision ?? 0) !== payment.expectedRevision || (payment.maximumMembers !== null && members > payment.maximumMembers)) {
      await sequelize.query(`UPDATE "SubscriptionPayments" SET status = 'review', "providerId" = :providerId, "paidAt" = now()
        WHERE reference = :reference`, { replacements: { reference, providerId: verified.id }, transaction });
      await billingEvent('payment.requires_review', payment.actorId, payment.cooperativeId, reference, {}, transaction);
      return { status: 'review' };
    }
    const startsAt = term?.status === 'active' && term.planId === payment.planId ? term.endsAt : new Date();
    const interval = payment.cycle === 'annual' ? '1 year' : '1 month';
    await sequelize.query(`
      WITH new_term AS (
        INSERT INTO "CooperativeSubscriptions" ("cooperativeId","planId","maximumMembers",cycle,"startsAt","endsAt","graceDays")
        VALUES (:cooperativeId,:planId,:maximumMembers,:cycle,:startsAt,
          (CAST(:startsAt AS timestamptz) AT TIME ZONE 'Africa/Lagos' + CAST(:interval AS interval)) AT TIME ZONE 'Africa/Lagos',:graceDays)
        ON CONFLICT ("cooperativeId") DO UPDATE SET "planId" = excluded."planId", "maximumMembers" = excluded."maximumMembers",
          cycle = excluded.cycle, "startsAt" = CASE WHEN :extends THEN "CooperativeSubscriptions"."startsAt" ELSE excluded."startsAt" END,
          "endsAt" = excluded."endsAt", "graceDays" = excluded."graceDays", trial = false, "cancelledAt" = NULL,
          revision = "CooperativeSubscriptions".revision + 1 RETURNING "endsAt"
      )
      UPDATE "SubscriptionPayments" SET status = 'paid', "providerId" = :providerId, "paidAt" = now(),
        "periodStart" = :startsAt, "periodEnd" = (SELECT "endsAt" FROM new_term) WHERE reference = :reference
    `, { replacements: { ...payment, startsAt, interval, providerId: verified.id,
      extends: term?.status === 'active' && term.planId === payment.planId }, transaction });
    await billingEvent('payment.applied', payment.actorId, payment.cooperativeId, reference, { cycle: payment.cycle, planId: payment.planId }, transaction);
    await enqueueBillingEmail('paid:' + reference, payment.cooperativeId, payment.actorId, 'Co-opSphere subscription payment confirmed',
      `Payment ${reference} for ${payment.planName} was verified. Open Billing in Co-opSphere to see the subscription term and download its receipt.`, transaction);
    return { status: 'paid' };
  });
}

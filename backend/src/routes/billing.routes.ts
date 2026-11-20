import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { RequestHandler, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import PDFDocument from 'pdfkit';
import sequelize from '../config/database';
import { brand } from '../config/brand';
import { authenticate, authenticateOwner, restrictTo } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import Cooperative from '../models/Cooperative';
import Member from '../models/Member';
import { drainBillingEmails, queueBillingReminders } from '../services/billing-notifications';
import { checkout, settleCheckout } from '../services/billing-checkout';
import { availableGateways, Gateway } from '../services/billing-gateways';
import { money } from '../services/finance';
import { billingEvent, capacity, currentTerm, listPlans, lockCooperative, select, termStatus } from '../services/subscriptions';

export const billingRoutes = Router();
export const platformBilling = Router();
const billingLimit = rateLimit({ windowMs: 60000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
const tenantAdmin = restrictTo('admin');
const billingFields = `reference,"planName","maximumMembers",cycle,gateway,mode,"amountMinor",currency,status,"providerId",
  "createdAt","paidAt","periodStart","periodEnd"`;
const profileFields = ['registrationNumber', 'cooperativeType', 'address', 'state', 'country', 'email', 'phone', 'establishedOn', 'description'] as const;

billingRoutes.get('/plans', async (_req, res, next) => {
  try { res.json({ data: await listPlans() }); } catch (error) { next(error); }
});
billingRoutes.use(authenticate);

billingRoutes.get('/access', async (req, res, next) => {
  try { res.json({ data: await capacity(req.user!.cooperativeId) }); } catch (error) { next(error); }
});

billingRoutes.get('/', tenantAdmin, async (req, res, next) => {
  try {
    const cooperativeId = req.user!.cooperativeId;
    const [state, history, cooperative] = await Promise.all([
      capacity(cooperativeId),
      select(`SELECT ${billingFields} FROM "SubscriptionPayments" WHERE "cooperativeId" = :cooperativeId ORDER BY "createdAt" DESC, reference LIMIT 100`, { cooperativeId }),
      Cooperative.findByPk(cooperativeId)
    ]);
    const settings = cooperative!.settings || {};
    res.json({ data: { ...state, history, gateways: availableGateways(),
      profile: { name: cooperative!.name, ...Object.fromEntries(profileFields.map(key => [key, settings[key] || ''])) } } });
  } catch (error) { next(error); }
});

billingRoutes.put('/profile', tenantAdmin, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (typeof name !== 'string' || !name.trim() || name.length > 160) throw new AppError('Enter a valid cooperative name.', 400);
    const fields: Record<string, string> = {};
    for (const key of profileFields) {
      const value = req.body[key];
      if (typeof value !== 'string' || value.length > (key === 'description' ? 1500 : 500)) {
        throw new AppError(`Enter a valid value for ${key}.`, 400);
      }
      fields[key] = value.trim();
    }
    if (!fields.cooperativeType || !fields.address || !fields.state || !fields.country || !fields.phone ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email) ||
        (fields.establishedOn && !/^\d{4}-\d{2}-\d{2}$/.test(fields.establishedOn))) {
      throw new AppError('Complete the required cooperative profile fields.', 400);
    }
    await sequelize.transaction(async transaction => {
      const cooperative = await lockCooperative(req.user!.cooperativeId, transaction);
      await cooperative.update({ name: name.trim(), settings: { ...cooperative.settings, ...fields } }, { transaction });
    });
    res.json({ message: 'Cooperative profile saved.' });
  } catch (error) { next(error); }
});

billingRoutes.post('/checkout', tenantAdmin, billingLimit, async (req, res, next) => {
  try {
    const { cooperativeId, id, email } = req.user!;
    res.status(201).json({ data: await checkout(cooperativeId, id, email, req.body) });
  } catch (error) { next(error); }
});
billingRoutes.post('/verify/:reference', tenantAdmin, billingLimit, async (req, res, next) => {
  try { res.json({ data: await settleCheckout(req.params.reference, req.user!.cooperativeId) }); }
  catch (error) { next(error); }
});

billingRoutes.post('/cancel-at-expiry', tenantAdmin, async (req, res, next) => {
  try {
    const { cooperativeId, id } = req.user!;
    await sequelize.transaction(async transaction => {
      await lockCooperative(cooperativeId, transaction);
      const [updated] = await select<{ endsAt: Date }>(`
        UPDATE "CooperativeSubscriptions" SET "cancelledAt" = now(), revision = revision + 1
        WHERE "cooperativeId" = :cooperativeId AND NOT trial AND "endsAt" > now() AND "cancelledAt" IS NULL
        RETURNING "endsAt"
      `, { cooperativeId }, transaction);
      if (updated) await billingEvent('subscription.cancelled_at_expiry', id, cooperativeId, null, { endsAt: updated.endsAt }, transaction);
    });
    res.json({ message: 'Any current paid access ends on its expiry date.' });
  } catch (error) { next(error); }
});

billingRoutes.get('/receipt/:reference', tenantAdmin, async (req, res, next) => {
  try {
    const [receipt] = await select<Record<string, any>>(`
      SELECT ${billingFields} FROM "SubscriptionPayments" WHERE reference = :reference AND "cooperativeId" = :cooperativeId AND status = 'paid'
    `, { reference: req.params.reference, cooperativeId: req.user!.cooperativeId });
    if (!receipt) throw new AppError('Receipt not found.', 404);
    const cooperative = await Cooperative.findByPk(req.user!.cooperativeId);
    const pdf = new PDFDocument();
    res.type('application/pdf').attachment(`${receipt.reference}.pdf`);
    pdf.pipe(res);
    pdf.fontSize(22).text(brand.name).fontSize(11).text(brand.tagline).moveDown();
    pdf.fontSize(18).text('Subscription payment receipt').moveDown();
    pdf.fontSize(12).text(cooperative!.name).text(`Reference: ${receipt.reference}`)
      .text(`Plan: ${receipt.planName} (${receipt.cycle})`).text(`Gateway: ${receipt.gateway}`)
      .text(`Amount: NGN ${money(Number(receipt.amountMinor))}`).text(`Paid at: ${receipt.paidAt.toISOString()}`)
      .text(`Billing period: ${receipt.periodStart.toISOString()} to ${receipt.periodEnd.toISOString()}`).moveDown().text(brand.attribution);
    pdf.end();
  } catch (error) { next(error); }
});

platformBilling.use(authenticateOwner);
platformBilling.get('/plans', async (_req, res, next) => {
  try { res.json({ data: await listPlans(true) }); } catch (error) { next(error); }
});
platformBilling.put('/plans/:slug', async (req, res, next) => {
  try {
    const { description, maximumMembers, monthlyMinor, annualMinor, features, displayOrder, active,
      recommended, customPricing, trialDays, graceDays } = req.body;
    const slug = req.params.slug;
    const price = (v: unknown) => v === null || (typeof v === 'string' && /^[1-9]\d{0,9}$/.test(v));
    const range = (value: unknown, min: number, max: number) => Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
    if (typeof description !== 'string' || description.length > 1200 || ![monthlyMinor, annualMinor].every(price) ||
        (maximumMembers === null ? slug !== 'enterprise-plus' : !range(maximumMembers, 1, 1000000)) ||
        !Array.isArray(features) || features.length > 30 || !features.every(f => typeof f === 'string' && f.trim() && f.length <= 160) ||
        !range(displayOrder, 1, 100) || !range(trialDays, 0, 90) || !range(graceDays, 0, 30) ||
        ![active, recommended, customPricing].every(v => typeof v === 'boolean') || (recommended && !active)) {
      throw new AppError('Check the price, capacity, features and subscription policy fields.', 400);
    }
    await sequelize.transaction(async transaction => {
      await sequelize.query('SELECT pg_advisory_xact_lock(2114826003)', { transaction });
      const catalog = await listPlans(true, transaction);
      const ordered = ['seed', 'growth', 'scale', 'enterprise', 'enterprise-plus'].map(key => catalog.find(p => p.slug === key)!);
      const index = ordered.findIndex(p => p.slug === slug);
      if (index < 0) throw new AppError('Plan not found.', 404);
      const max = maximumMembers ?? Infinity;
      if ((index > 0 && max <= (ordered[index - 1].maximumMembers ?? Infinity)) ||
          (index < ordered.length - 1 && max >= (ordered[index + 1].maximumMembers ?? Infinity))) {
        throw new AppError('Membership capacities must increase from Seed through Enterprise Plus.', 409);
      }
      if (recommended) await sequelize.query(`UPDATE "SubscriptionPlans" SET recommended = false WHERE recommended AND slug <> :slug`, { replacements: { slug }, transaction });
      await sequelize.query(`
        UPDATE "SubscriptionPlans" SET description = :description, "maximumMembers" = :maximumMembers,
          "monthlyMinor" = :monthlyMinor, "annualMinor" = :annualMinor,
          features = ARRAY(SELECT jsonb_array_elements_text(CAST(:features AS jsonb))),
          "displayOrder" = :displayOrder, active = :active, recommended = :recommended, "customPricing" = :customPricing,
          "trialDays" = :trialDays, "graceDays" = :graceDays, "updatedAt" = now() WHERE slug = :slug
      `, { replacements: { slug, description, maximumMembers, monthlyMinor, annualMinor, features: JSON.stringify(features),
        displayOrder, active, recommended, customPricing, trialDays, graceDays }, transaction });
      await billingEvent('plan.updated', req.platformOwner!.id, null, null,
        { slug, before: ordered[index], after: { monthlyMinor, annualMinor, maximumMembers, recommended, active, trialDays, graceDays } }, transaction);
    });
    res.json({ message: 'Plan updated.' });
  } catch (error) { next(error); }
});

platformBilling.get('/payments', async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 160) : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    if (status && !['paid', 'pending', 'failed', 'review'].includes(status)) throw new AppError('Invalid payment status.', 400);
    res.json({ data: await select(`SELECT ${billingFields.split(',').map(column => 'p.' + column.trim()).join(',')},
      p."cooperativeId", c.name AS "cooperativeName"
      FROM "SubscriptionPayments" p JOIN "Cooperatives" c ON c.id = p."cooperativeId"
      WHERE (:status = '' OR p.status = :status)
        AND (:search = '' OR strpos(lower(c.name), lower(:search)) > 0 OR strpos(p.reference, lower(:search)) > 0)
      ORDER BY p."createdAt" DESC, p.reference LIMIT 100`, { status, search }) });
  } catch (error) { next(error); }
});

platformBilling.get('/subscriptions', async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 160) : '';
    res.json({ data: await select(`
      SELECT c.id AS "cooperativeId", c.name AS "cooperativeName", p.name AS "planName",
        s."endsAt", s."maximumMembers", CASE WHEN s."cooperativeId" IS NULL THEN 'unsubscribed' ELSE ${termStatus} END AS status
      FROM "Cooperatives" c LEFT JOIN "CooperativeSubscriptions" s ON s."cooperativeId" = c.id
      LEFT JOIN "SubscriptionPlans" p ON p.id = s."planId"
      WHERE :search = '' OR strpos(lower(c.name), lower(:search)) > 0 OR c.id::text = lower(:search)
      ORDER BY s."endsAt" DESC NULLS LAST, c.name, c.id LIMIT 100
    `, { search }) });
  } catch (error) { next(error); }
});

platformBilling.post('/trial/:cooperativeId', async (req, res, next) => {
  try {
    const { cooperativeId } = req.params;
    const { plan } = req.body;
    if (typeof plan !== 'string') throw new AppError('Select a trial plan.', 400);
    await sequelize.transaction(async transaction => {
      await lockCooperative(cooperativeId, transaction);
      if (await currentTerm(cooperativeId, transaction)) throw new AppError('This cooperative already has a subscription record.', 409);
      const p = (await listPlans(false, transaction)).find(item => item.slug === plan);
      if (!p || !p.trialDays) throw new AppError('This plan has no authorised trial policy.', 409);
      const used = await Member.count({ where: { cooperativeId }, transaction });
      if (p.maximumMembers !== null && used > p.maximumMembers) throw new AppError('This cooperative exceeds the trial capacity.', 409);
      await sequelize.query(`
        INSERT INTO "CooperativeSubscriptions" ("cooperativeId","planId","maximumMembers","startsAt","endsAt",trial)
        VALUES (:cooperativeId,:planId,:maximumMembers,now(),now() + make_interval(days => :days),true)
      `, { transaction, replacements: { cooperativeId, planId: p.id, maximumMembers: p.maximumMembers, days: p.trialDays } });
      await billingEvent('trial.granted', req.platformOwner!.id, cooperativeId, null, { plan, days: p.trialDays }, transaction);
    });
    res.status(201).json({ message: 'Trial granted.' });
  } catch (error) { next(error); }
});

const match = (received: string | undefined, expected: string) =>
  Boolean(received && expected && Buffer.byteLength(received) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(received), Buffer.from(expected)));

export function billingWebhook(gateway: Gateway): RequestHandler {
  return async (req, res, next) => {
    try {
      if (!Buffer.isBuffer(req.body) || !availableGateways().includes(gateway)) throw new AppError('Invalid gateway webhook.', 401);
      const valid = gateway === 'paystack'
        ? match(req.get('x-paystack-signature'), createHmac('sha512', process.env.SAAS_PAYSTACK_SECRET_KEY!).update(req.body).digest('hex'))
        : match(req.get('verif-hash'), process.env.SAAS_FLUTTERWAVE_WEBHOOK_HASH || '');
      if (!valid) throw new AppError('Invalid gateway webhook.', 401);
      const event = JSON.parse(req.body.toString('utf8'));
      const reference = gateway === 'paystack' ? event.data?.reference : event.data?.tx_ref;
      if (typeof reference === 'string' && reference.startsWith('cs-sub-') &&
          (gateway === 'paystack' ? event.event === 'charge.success' : event.event === 'charge.completed')) {
        try {
          const { status } = await settleCheckout(reference, undefined, gateway);
          await sequelize.query(`
            INSERT INTO "BillingWebhookEvents" (gateway,digest,reference,outcome) VALUES (:gateway,:digest,:reference,:status)
            ON CONFLICT (gateway,digest) DO NOTHING
          `, { replacements: { gateway, digest: createHash('sha256').update(req.body).digest('hex'), reference, status } });
        } catch (error) {
          if (!(error instanceof AppError && error.statusCode === 404)) throw error;
        }
      }
      res.sendStatus(200);
    } catch (error) { next(error); }
  };
}

export const billingJob: RequestHandler = async (req, res, next) => {
  try {
    const secret = process.env.CRON_SECRET || '';
    if (secret.length < 32 || !match(req.get('Authorization'), 'Bearer ' + secret)) {
      throw new AppError('Job access denied.', 401);
    }
    await queueBillingReminders();
    res.json({ sent: await drainBillingEmails() });
  } catch (error) { next(error); }
};

import { randomUUID } from 'crypto';
import { RequestHandler, Router } from 'express';
import { QueryTypes } from 'sequelize';
import sequelize from '../config/database';
import { authenticate, restrictTo } from '../middleware/auth';
import { ownMember } from '../middleware/cooperative';
import { AppError } from '../middleware/errorHandler';
import Member from '../models/Member';
import Transaction from '../models/Transaction';
import { recordAudit } from '../services/audit';
import { money, positiveAmount, postEntry, toMinorUnits } from '../services/finance';
import { initializePaystack, testPaystackConfig, validPaystackSignature, verifyPaystack } from '../services/paystack';

const router = Router();

interface Intent {
  reference: string;
  cooperativeId: string;
  memberId: string;
  requestedBy: string;
  amount: string;
  transactionId: string | null;
}

function validReference(value: unknown): value is string {
  return typeof value === 'string' && /^ec-test-[a-f0-9-]{36}$/.test(value);
}

async function findIntent(reference: string, cooperativeId: string) {
  const [intent] = await sequelize.query<Intent>(`
    SELECT * FROM "PaymentIntents" WHERE reference = :reference AND "cooperativeId" = :cooperativeId
  `, { replacements: { reference, cooperativeId }, type: QueryTypes.SELECT });
  return intent;
}

async function reconcile(intent: Intent, secret: string) {
  if (intent.transactionId) return intent.transactionId;
  const result = await verifyPaystack(secret, intent.reference);
  if (result.status !== 'success') return null;
  if (result.reference !== intent.reference || result.currency !== 'NGN' || result.domain !== 'test' ||
    result.amount !== positiveAmount(intent.amount)) {
    throw new AppError('Payment verification does not match the checkout details', 409);
  }

  return sequelize.transaction(async transaction => {
    const replacements = { reference: intent.reference, cooperativeId: intent.cooperativeId };
    const [current] = await sequelize.query<Intent>(`
      SELECT * FROM "PaymentIntents" WHERE reference = :reference AND "cooperativeId" = :cooperativeId FOR UPDATE
    `, { replacements, type: QueryTypes.SELECT, transaction });
    if (!current) throw new AppError('Payment not found', 404);
    if (current.transactionId) return current.transactionId;

    const member = await Member.findOne({
      where: { id: current.memberId, cooperativeId: current.cooperativeId },
      transaction, lock: transaction.LOCK.UPDATE
    });
    if (!member) throw new AppError('Member record is unavailable', 409);

    const amount = positiveAmount(current.amount);
    const balance = toMinorUnits(member.savings || 0) + amount;
    if (balance > 9999999999) throw new AppError('Savings limit exceeded', 409);
    await member.update({ savings: money(balance) }, { transaction });
    const entry = await Transaction.create({
      cooperativeId: current.cooperativeId, memberId: current.memberId, type: 'deposit', amount: current.amount,
      description: 'Paystack test savings deposit', status: 'completed', requestedBy: current.requestedBy,
      externalReference: current.reference
    }, { transaction });
    await postEntry(transaction, current.cooperativeId, entry.id, 1, 'payment_clearing', 'member_savings', amount);
    await recordAudit(transaction, current.cooperativeId, current.requestedBy, 'payment.test_deposit', entry.id);
    await sequelize.query(`
      UPDATE "PaymentIntents" SET "transactionId" = :id, "completedAt" = now()
      WHERE reference = :reference AND "cooperativeId" = :cooperativeId
    `, { replacements: { ...replacements, id: entry.id }, transaction });
    return entry.id;
  });
}

router.use(authenticate, restrictTo('member'));
router.get('/config', (req, res) => {
  res.json({ data: { testDeposits: Boolean(testPaystackConfig(req.user!.cooperativeId)) } });
});

router.post('/deposit', async (req, res, next) => {
  try {
    const { cooperativeId, id, email } = req.user!;
    const config = testPaystackConfig(cooperativeId);
    if (!config) throw new AppError('Test deposits are unavailable', 503);
    const member = await ownMember(req);
    const amount = positiveAmount(req.body.amount);
    const reference = 'ec-test-' + randomUUID();
    await sequelize.query(`
      INSERT INTO "PaymentIntents" (reference, "cooperativeId", "memberId", "requestedBy", provider, amount, currency)
      VALUES (:reference, :cooperativeId, :memberId, :id, 'paystack_test', :amount, 'NGN')
    `, { replacements: { reference, cooperativeId, memberId: member.id, id, amount: money(amount) } });
    const callback = new URL('/user-dashboard', process.env.FRONTEND_URL || 'http://localhost:3000');
    callback.searchParams.set('deposit', reference);
    const checkout = await initializePaystack(config.secret, reference, email, amount, callback.href);
    res.status(201).json({ data: { reference, checkout } });
  } catch (error) {
    next(error);
  }
});

router.post('/:reference/verify', async (req, res, next) => {
  try {
    const { cooperativeId } = req.user!;
    const config = testPaystackConfig(cooperativeId);
    if (!config || !validReference(req.params.reference)) throw new AppError('Payment not found', 404);
    const member = await ownMember(req);
    const intent = await findIntent(req.params.reference, cooperativeId);
    if (!intent || intent.memberId !== member.id) throw new AppError('Payment not found', 404);
    const transactionId = await reconcile(intent, config.secret);
    res.json({ data: { status: transactionId ? 'completed' : 'pending', transactionId } });
  } catch (error) {
    next(error);
  }
});

export const paystackWebhook: RequestHandler = async (req, res, next) => {
  try {
    const config = testPaystackConfig();
    if (!config) throw new AppError('Webhook unavailable', 503);
    if (!Buffer.isBuffer(req.body) || !validPaystackSignature(
      req.body, req.get('x-paystack-signature'), req.get('paystack-signature'), config.secret,
      [process.env.PAYSTACK_WEBHOOK_SECRET, process.env.PAYSTACK_PREVIOUS_WEBHOOK_SECRET]
        .filter((secret): secret is string => Boolean(secret))
    )) throw new AppError('Invalid webhook signature', 401);

    const payload = JSON.parse(req.body.toString('utf8'));
    if (payload.event === 'charge.success' && validReference(payload.data?.reference)) {
      const intent = await findIntent(payload.data.reference, config.cooperativeId);
      if (intent && !await reconcile(intent, config.secret)) throw new AppError('Payment is awaiting provider verification', 503);
    }
    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
};

export default router;

import { Transaction } from 'sequelize';
import sequelize from '../config/database';
import { brand } from '../config/brand';
import { sendEmail } from '../utils/email';
import { select } from './subscriptions';

export async function enqueueBillingEmail(key: string, cooperativeId: string, actorId: string, subject: string, body: string, transaction: Transaction) {
  await sequelize.query(`
    INSERT INTO "BillingNotifications" (key,"cooperativeId","recipientId",subject,body)
    VALUES (:key,:cooperativeId,:actorId,:subject,:body) ON CONFLICT (key) DO NOTHING
  `, { transaction, replacements: { key, cooperativeId, actorId, subject, body } });
}

export async function queueBillingReminders() {
  await sequelize.query(`
    WITH terms AS (
      SELECT s.*, ((s."endsAt" AT TIME ZONE 'Africa/Lagos')::date - (now() AT TIME ZONE 'Africa/Lagos')::date) AS days
      FROM "CooperativeSubscriptions" s JOIN "Cooperatives" c ON c.id = s."cooperativeId"
      WHERE c."suspendedAt" IS NULL
    ), due AS (
      SELECT t.*, CASE
        WHEN days IN (14,7,3) AND "cancelledAt" IS NULL THEN 'before-' || days
        WHEN days <= 0 AND "endsAt" <= now() AND ("cancelledAt" IS NOT NULL OR trial OR "graceDays" = 0) THEN 'expired'
        WHEN "endsAt" <= now() AND "endsAt" + make_interval(days => "graceDays") > now() THEN 'grace'
        WHEN "endsAt" + make_interval(days => "graceDays") <= now() THEN 'expired'
        END AS notice
      FROM terms t
    )
    INSERT INTO "BillingNotifications" (key,"cooperativeId","recipientId",subject,body)
    SELECT 'term:' || d."cooperativeId" || ':' || extract(epoch FROM d."endsAt") || ':' || notice,
      d."cooperativeId", recipient.id, :subject,
      CASE notice WHEN 'expired' THEN 'Your Co-opSphere subscription term has ended.'
        WHEN 'grace' THEN 'Your Co-opSphere subscription term has ended and is in its grace period.'
        ELSE 'Your Co-opSphere subscription is due to end in ' || d.days || ' days.' END
      || E'\\n\\nOpen Billing to review your subscription: ' || :url
    FROM due d JOIN LATERAL (
      SELECT id FROM "Users" WHERE "cooperativeId" = d."cooperativeId" AND role = 'admin' AND "isActive" AND "isEmailVerified"
      ORDER BY "createdAt", id LIMIT 1
    ) recipient ON true WHERE notice IS NOT NULL ON CONFLICT (key) DO NOTHING
  `, { replacements: { subject: `${brand.name} subscription reminder`, url: (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '') + '/billing' } });
}

export async function drainBillingEmails() {
  const entries = await select<{ key: string }>(`
    SELECT key FROM "BillingNotifications" WHERE "sentAt" IS NULL AND attempts < 5 AND "nextAttemptAt" <= now()
    ORDER BY "nextAttemptAt", key LIMIT 15
  `);
  const results = await Promise.allSettled(entries.map(({ key }) => sequelize.transaction(async transaction => {
    const [notice] = await select<{ email: string; subject: string; body: string }>(`
      SELECT u.email, n.subject, n.body FROM "BillingNotifications" n JOIN "Users" u ON u.id = n."recipientId"
      WHERE n.key = :key AND n."sentAt" IS NULL AND n.attempts < 5 AND n."nextAttemptAt" <= now()
      FOR UPDATE OF n SKIP LOCKED
    `, { key }, transaction);
    if (!notice) return false;
    try {
      await sendEmail(notice.email, notice.subject, notice.body);
    } catch {
      await sequelize.query(`UPDATE "BillingNotifications" SET attempts = attempts + 1,
        "nextAttemptAt" = now() + interval '1 hour' WHERE key = :key`, { transaction, replacements: { key } });
      return false;
    }
    await sequelize.query(`UPDATE "BillingNotifications" SET "sentAt" = now() WHERE key = :key`, { transaction, replacements: { key } });
    return true;
  })));
  return results.filter(result => result.status === 'fulfilled' && result.value).length;
}

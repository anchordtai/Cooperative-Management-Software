import { Transaction } from 'sequelize';
import sequelize from '../config/database';

export function recordAudit(
  transaction: Transaction, cooperativeId: string, actorId: string, action: string, recordId: string,
  details: Record<string, unknown> = {}
) {
  return sequelize.query(`
    INSERT INTO "AuditEvents" ("cooperativeId", "actorId", action, "recordId", details)
    VALUES (:cooperativeId, :actorId, :action, :recordId, CAST(:details AS jsonb))
  `, { replacements: { cooperativeId, actorId, action, recordId, details: JSON.stringify(details) }, transaction });
}

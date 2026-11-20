import { Router } from 'express';
import { QueryTypes } from 'sequelize';
import sequelize from '../config/database';
import { authenticateOwner } from '../middleware/auth';
import { pagination } from '../middleware/cooperative';
import { AppError } from '../middleware/errorHandler';
import Cooperative from '../models/Cooperative';

const router = Router();
router.use(authenticateOwner);

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const auditActions = ['tenant.suspended', 'tenant.reactivated'];
const searchTerm = (value: unknown) => {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > 160) throw new AppError('Enter a search of up to 160 characters.', 400);
  return value.trim();
};

router.get('/overview', async (_req, res, next) => {
  try {
    const [overview] = await sequelize.query(`
      SELECT count(*) AS "tenantCount",
        count(*) FILTER (WHERE c."suspendedAt" IS NULL) AS "activeTenants",
        count(*) FILTER (WHERE c."suspendedAt" IS NOT NULL) AS "suspendedTenants",
        count(*) FILTER (WHERE c."createdAt" >= now() - interval '30 days') AS "newTenants",
        count(*) FILTER (WHERE c."suspendedAt" IS NULL AND NOT EXISTS (
          SELECT 1 FROM "Users" u WHERE u."cooperativeId" = c.id AND u.role = 'admin'
            AND u."isActive" AND u."isEmailVerified"
        )) AS "tenantsWithoutActiveAdmin",
        (SELECT count(*) FROM "Members" m JOIN "Cooperatives" mc ON mc.id = m."cooperativeId") AS "memberCount",
        now() AS "asOf"
      FROM "Cooperatives" c
    `, { type: QueryTypes.SELECT });
    res.json({ data: overview });
  } catch (error) {
    next(error);
  }
});

router.get('/tenants', async (req, res, next) => {
  try {
    const { limitNum, offset, currentPage } = pagination(req);
    const search = searchTerm(req.query.search);
    const { status = 'all', sort = 'newest' } = req.query;
    if (typeof status !== 'string' || !['all', 'active', 'suspended'].includes(status) ||
        typeof sort !== 'string' || !['newest', 'oldest', 'name'].includes(sort)) {
      throw new AppError('Choose a valid tenant status and sort order.', 400);
    }
    const order = sort === 'name' ? 'lower(c.name), c.id' : sort === 'oldest' ? 'c."createdAt", c.id' : 'c."createdAt" DESC, c.id';
    const tenants = await sequelize.query(`
      SELECT c.id, c.name, c."createdAt", c."suspendedAt",
        (SELECT count(*) FROM "Members" WHERE "cooperativeId" = c.id) AS "memberCount",
        EXISTS (SELECT 1 FROM "Users" u WHERE u."cooperativeId" = c.id AND u.role = 'admin'
          AND u."isActive" AND u."isEmailVerified") AS "hasActiveAdmin"
      FROM "Cooperatives" c
      WHERE (:search = '' OR strpos(lower(c.name), lower(:search)) > 0 OR c.id::text = lower(:search))
        AND (:status = 'all' OR (:status = 'active' AND c."suspendedAt" IS NULL)
          OR (:status = 'suspended' AND c."suspendedAt" IS NOT NULL))
      ORDER BY ${order} LIMIT :limit OFFSET :offset
    `, { type: QueryTypes.SELECT, replacements: { search, status, limit: limitNum + 1, offset } });
    res.json({ data: tenants.slice(0, limitNum), page: currentPage, hasNext: tenants.length > limitNum });
  } catch (error) {
    next(error);
  }
});

router.get('/tenants/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!uuid.test(id)) throw new AppError('Provide a valid tenant ID.', 400);
    const [tenant] = await sequelize.query(`
      SELECT c.id, c.name, c."createdAt", c."suspendedAt",
        m."memberCount", m."activeMembers", u."verifiedAdmins", u."pendingAdmins", u."activeStaff",
        (SELECT max("createdAt") FROM "PlatformAuditEvents" a WHERE a."cooperativeId" = c.id) AS "lastAccessChange"
      FROM "Cooperatives" c
      CROSS JOIN LATERAL (
        SELECT count(*) AS "memberCount", count(*) FILTER (WHERE status = 'active') AS "activeMembers"
        FROM "Members" WHERE "cooperativeId" = c.id
      ) m
      CROSS JOIN LATERAL (
        SELECT count(*) FILTER (WHERE role = 'admin' AND "isActive" AND "isEmailVerified") AS "verifiedAdmins",
          count(*) FILTER (WHERE role = 'admin' AND "isActive" AND NOT "isEmailVerified") AS "pendingAdmins",
          count(*) FILTER (WHERE role = 'staff' AND "isActive" AND "isEmailVerified") AS "activeStaff"
        FROM "Users" WHERE "cooperativeId" = c.id
      ) u WHERE c.id = :id
    `, { type: QueryTypes.SELECT, replacements: { id } });
    if (!tenant) throw new AppError('Tenant not found.', 404);
    res.json({ data: tenant });
  } catch (error) {
    next(error);
  }
});

router.patch('/tenants/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!uuid.test(id) ||
        !['active', 'suspended'].includes(status)) {
      throw new AppError('Provide a tenant ID and a valid status.', 400);
    }
    const tenant = await sequelize.transaction(async transaction => {
      const cooperative = await Cooperative.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!cooperative) throw new AppError('Tenant not found.', 404);
      if (Boolean(cooperative.suspendedAt) !== (status === 'suspended')) {
        await cooperative.update({ suspendedAt: status === 'suspended' ? new Date() : null }, { transaction });
        if (status === 'suspended') {
          await sequelize.query(`
            DELETE FROM "Sessions" s USING "Users" u
            WHERE s."userId" = u.id AND u."cooperativeId" = :id
          `, { transaction, replacements: { id } });
        }
        await sequelize.query(`
          INSERT INTO "PlatformAuditEvents" ("actorId", "cooperativeId", action)
          VALUES (:actor, :id, :action)
        `, { transaction, replacements: {
          actor: req.platformOwner!.id, id, action: status === 'suspended' ? 'tenant.suspended' : 'tenant.reactivated'
        } });
      }
      return { id: cooperative.id, suspendedAt: cooperative.suspendedAt };
    });
    res.json({ data: tenant });
  } catch (error) {
    next(error);
  }
});

router.get('/audit', async (req, res, next) => {
  try {
    const { limitNum, offset, currentPage } = pagination(req);
    const search = searchTerm(req.query.search);
    const { action = '', tenantId = '' } = req.query;
    if (typeof action !== 'string' || (action && !auditActions.includes(action)) ||
        typeof tenantId !== 'string' || (tenantId && !uuid.test(tenantId))) {
      throw new AppError('Choose a valid audit action and tenant.', 400);
    }
    const events = await sequelize.query(`
      SELECT a.id, a.action, a."createdAt", a."cooperativeId", c.name AS "tenantName"
      FROM "PlatformAuditEvents" a JOIN "Cooperatives" c ON c.id = a."cooperativeId"
      WHERE (:action = '' OR a.action = :action)
        AND (:tenantId = '' OR a."cooperativeId" = CAST(nullif(:tenantId, '') AS uuid))
        AND (:search = '' OR strpos(lower(c.name), lower(:search)) > 0)
      ORDER BY a.id DESC LIMIT :limit OFFSET :offset
    `, { type: QueryTypes.SELECT, replacements: { search, action, tenantId, limit: limitNum + 1, offset } });
    res.json({ data: events.slice(0, limitNum), page: currentPage, hasNext: events.length > limitNum });
  } catch (error) {
    next(error);
  }
});

export default router;

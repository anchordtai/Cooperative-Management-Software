import { Router } from 'express';
import { QueryTypes } from 'sequelize';
import sequelize from '../config/database';
import { authenticateOwner } from '../middleware/auth';
import { pagination } from '../middleware/cooperative';
import { AppError } from '../middleware/errorHandler';
import Cooperative from '../models/Cooperative';

const router = Router();
router.use(authenticateOwner);

router.get('/tenants', async (req, res, next) => {
  try {
    const { limitNum, offset, currentPage } = pagination(req);
    const tenants = await sequelize.query(`
      SELECT id, name, "createdAt", "suspendedAt",
        (SELECT count(*) FROM "Members" WHERE "cooperativeId" = c.id) AS "memberCount"
      FROM "Cooperatives" c ORDER BY "createdAt" DESC, id LIMIT :limit OFFSET :offset
    `, { type: QueryTypes.SELECT, replacements: { limit: limitNum + 1, offset } });
    res.json({ data: tenants.slice(0, limitNum), page: currentPage, hasNext: tenants.length > limitNum });
  } catch (error) {
    next(error);
  }
});

router.patch('/tenants/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
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
    const events = await sequelize.query(`
      SELECT a.id, a.action, a."createdAt", a."cooperativeId", c.name AS "tenantName"
      FROM "PlatformAuditEvents" a JOIN "Cooperatives" c ON c.id = a."cooperativeId"
      ORDER BY a.id DESC LIMIT :limit OFFSET :offset
    `, { type: QueryTypes.SELECT, replacements: { limit: limitNum + 1, offset } });
    res.json({ data: events.slice(0, limitNum), page: currentPage, hasNext: events.length > limitNum });
  } catch (error) {
    next(error);
  }
});

export default router;

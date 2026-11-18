import { Router } from 'express';
import { QueryTypes } from 'sequelize';
import sequelize from '../config/database';
import { authenticate } from '../middleware/auth';
import { pagination } from '../middleware/cooperative';
import { permit } from '../middleware/permissions';

const router = Router();

router.get('/', authenticate, permit('audit.read'), async (req, res, next) => {
  try {
    const cooperativeId = req.user!.cooperativeId;
    const { limitNum, offset, currentPage } = pagination(req);
    const audit = await sequelize.query(`
      SELECT events.id, events.action, events."recordId", events.details, events."createdAt",
        people."firstName", people."lastName"
      FROM "AuditEvents" events
      JOIN "Users" people ON people.id = events."actorId" AND people."cooperativeId" = events."cooperativeId"
      WHERE events."cooperativeId" = :cooperativeId
      ORDER BY events.id DESC LIMIT :limit OFFSET :offset
    `, { replacements: { cooperativeId, limit: limitNum + 1, offset }, type: QueryTypes.SELECT });
    res.json({ data: audit.slice(0, limitNum), hasNext: audit.length > limitNum, currentPage });
  } catch (error) {
    next(error);
  }
});

export default router;

import { permit } from '../middleware/permissions';
import { Router } from 'express';
import { QueryTypes } from 'sequelize';
import sequelize from '../config/database';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, permit('finance.read'), async (req, res, next) => {
  try {
    const cooperativeId = req.user!.cooperativeId;
    const [summary] = await sequelize.query(`
      SELECT
        (SELECT name FROM "Cooperatives" WHERE id = :cooperativeId) AS "cooperativeName",
        (SELECT count(*) FROM "Members" WHERE "cooperativeId" = :cooperativeId) AS "totalMembers",
        (SELECT coalesce(sum(savings), 0) FROM "Members" WHERE "cooperativeId" = :cooperativeId) AS "totalSavings",
        (SELECT count(*) FROM "Loans" WHERE "cooperativeId" = :cooperativeId AND status = 'active') AS "activeLoans",
        (SELECT count(*) FROM "Loans" WHERE "cooperativeId" = :cooperativeId AND status = 'pending') AS "pendingLoans"
    `, { replacements: { cooperativeId }, type: QueryTypes.SELECT });
    res.json({ data: summary });
  } catch (error) {
    next(error);
  }
});

export default router;

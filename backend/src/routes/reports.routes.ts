import { permit } from '../middleware/permissions';
import { Router } from 'express';
import { QueryTypes } from 'sequelize';
import sequelize from '../config/database';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { reconciliationReport } from '../services/reconciliation';

const router = Router();

router.get('/activity', authenticate, permit('reports.read'), async (req, res, next) => {
  try {
    const { months = '12' } = req.query;
    if (typeof months !== 'string' || !['3', '6', '12'].includes(months)) {
      throw new AppError('Select a 3, 6 or 12 month report', 400);
    }
    const cooperativeId = req.user!.cooperativeId;
    const entries = await sequelize.query(`
      WITH periods AS (
        SELECT generate_series(
          date_trunc('month', timezone('Africa/Lagos', now())) - make_interval(months => :months - 1),
          date_trunc('month', timezone('Africa/Lagos', now())),
          interval '1 month'
        ) AS period
      ), activity AS (
        SELECT date_trunc('month', timezone('Africa/Lagos', CASE WHEN type = 'withdrawal' THEN "updatedAt" ELSE "createdAt" END)) AS period,
          sum(amount) FILTER (WHERE type = 'deposit') AS deposits,
          sum(amount) FILTER (WHERE type = 'withdrawal') AS withdrawals,
          sum(amount) FILTER (WHERE type = 'loan') AS disbursements,
          sum(amount) FILTER (WHERE type = 'repayment') AS repayments
        FROM "Transactions"
        WHERE "cooperativeId" = :cooperativeId AND status = 'completed' AND type IN ('deposit', 'withdrawal', 'loan', 'repayment')
          AND (CASE WHEN type = 'withdrawal' THEN "updatedAt" ELSE "createdAt" END) >= ((SELECT min(period) FROM periods) AT TIME ZONE 'Africa/Lagos')
        GROUP BY 1
      )
      SELECT to_char(period, 'YYYY-MM') AS month, coalesce(deposits, 0) AS deposits,
        coalesce(withdrawals, 0) AS withdrawals, coalesce(disbursements, 0) AS disbursements,
        coalesce(repayments, 0) AS repayments
      FROM periods LEFT JOIN activity USING (period)
      ORDER BY period
    `, { replacements: { cooperativeId, months: Number(months) }, type: QueryTypes.SELECT });

    res.json({ data: entries });
  } catch (error) {
    next(error);
  }
});

router.get('/reconciliation', authenticate, permit('reports.read'), async (req, res, next) => {
  try {
    const { from, to, page } = req.query;
    const report = await reconciliationReport(req.user!.cooperativeId, from, to, page);
    res.json({ data: report });
  } catch (error) {
    next(error);
  }
});

export default router;

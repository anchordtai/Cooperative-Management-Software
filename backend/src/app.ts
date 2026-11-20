import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { AppError, errorHandler } from './middleware/errorHandler';
import sequelize from './config/database';
import { allowedFrontendOrigins } from './config/frontend';
import './models';
import authRoutes from './routes/auth.routes';
import memberRoutes from './routes/member.routes';
import financialRoutes from './routes/financial.routes';
import transactionsRoutes from './routes/transactions.routes';
import settingsRoutes from './routes/settings.routes';
import dashboardRoutes from './routes/dashboard.routes';
import reportsRoutes from './routes/reports.routes';
import staffRoutes from './routes/staff.routes';
import contactRoutes from './routes/contact.routes';
import auditRoutes from './routes/audit.routes';
import paymentsRoutes, { paystackWebhook } from './routes/payments.routes';
import documentsRoutes from './routes/documents.routes';

const app = express();
const frontendOrigins = allowedFrontendOrigins();

const databaseConfigured = process.env.VERCEL !== '1' ||
  Boolean(process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_PASSWORD));
if (process.env.TRUST_PROXY_HOPS) app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS));
app.disable('x-powered-by');
app.use(cors({
  origin: (origin, callback) => callback(null, Boolean(origin && frontendOrigins.has(origin))),
  credentials: true
}));
app.post('/api/webhooks/paystack', express.raw({ type: 'application/json', limit: '64kb' }), paystackWebhook);
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!databaseConfigured && !['/health'].includes(req.path)) {
    return next(new AppError('The cooperative database is not configured for this deployment', 503));
  }
  const origin = req.get('Origin');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    (req.get('X-ECooperative-Request') !== '1' || (origin && !frontendOrigins.has(origin)))) {
    return next(new AppError('Request origin is not allowed', 403));
  }
  return next();
});

app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/documents', documentsRoutes);

app.get(['/health', '/api/health'], async (_req, res) => {
  try {
    if (!databaseConfigured) {
      res.status(503).json({ status: 'unavailable' });
      return;
    }
    await sequelize.authenticate();
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});

app.use(errorHandler);

export default app;

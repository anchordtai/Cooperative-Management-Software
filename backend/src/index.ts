import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { AppError, errorHandler } from './middleware/errorHandler';
import { jwtSecret } from './middleware/auth';
import sequelize from './config/database';
import './models';
import authRoutes from './routes/auth.routes';
import memberRoutes from './routes/member.routes';
import financialRoutes from './routes/financial.routes';
import transactionsRoutes from './routes/transactions.routes';
import settingsRoutes from './routes/settings.routes';
import dashboardRoutes from './routes/dashboard.routes';

jwtSecret();
const app = express();
const frontendOrigin = new URL(process.env.FRONTEND_URL || 'http://localhost:3000').origin;
if (process.env.TRUST_PROXY_HOPS) app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS));
app.disable('x-powered-by');
app.use(cors({ origin: frontendOrigin, credentials: true }));
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const origin = req.get('Origin');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    (req.get('X-ECooperative-Request') !== '1' || (origin && origin !== frontendOrigin))) {
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

app.get('/health', async (_req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});

app.use(errorHandler);

const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`Server is running on port ${port}`));

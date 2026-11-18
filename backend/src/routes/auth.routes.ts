import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  register, acceptInvitation, login, verify2FA, verifyEmail, resendEmail, forgotPassword,
  resetPassword, logout, refreshToken, getMe
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const limit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many attempts. Try again later.' }
});

router.post('/register', limit, register);
router.post('/accept-invitation', limit, acceptInvitation);
router.post('/login', limit, login);
router.post('/verify-2fa', limit, verify2FA);
router.post('/verify-email', limit, verifyEmail);
router.post('/resend-email', limit, resendEmail);
router.post('/forgot-password', limit, forgotPassword);
router.post('/reset-password', limit, resetPassword);
router.post('/logout', logout);
router.post('/refresh-token', refreshToken);
router.get('/me', authenticate, getMe);

export default router;

import express from 'express';
import { register, login, logout, refreshToken, getMe, verify2FA, verifyEmail, verifyPhone, resendEmail, resendSMS, forgotPassword, resetPassword } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/verify-2fa', verify2FA);
router.get('/verify-email', verifyEmail);
router.post('/verify-phone', verifyPhone);
router.post('/resend-email', resendEmail);
router.post('/resend-sms', resendSMS);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.post('/logout', logout);
router.post('/refresh-token', refreshToken);
router.get('/me', authenticate, getMe);

export default router; 
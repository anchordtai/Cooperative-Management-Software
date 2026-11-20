import { brand } from '../config/brand';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AppError } from '../middleware/errorHandler';
import { sendEmail } from '../utils/email';

const router = Router();

router.post('/', rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, message: { message: 'Try again later.' } }), async (req, res, next) => {
  try {
    const { name, email, message } = req.body;
    if (typeof name !== 'string' || !name.trim() || name.length > 160 ||
      typeof email !== 'string' || email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof message !== 'string' || !message.trim() || message.length > 4000) {
      throw new AppError('Enter a name, valid email and a message up to 4,000 characters', 400);
    }
    const recipient = process.env.SUPPORT_EMAIL;
    if (!recipient) throw new AppError('The contact form is currently unavailable', 503);
    try {
      await sendEmail(recipient, `${brand.name} website enquiry`, `From ${name.trim()} <${email.trim()}>\n\n${message.trim()}`);
    } catch {
      throw new AppError('Your message could not be sent. Please try again later', 503);
    }
    res.json({ message: 'Your message was sent.' });
  } catch (error) {
    next(error);
  }
});

export default router;

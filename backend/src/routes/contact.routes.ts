import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { brand } from '../config/brand';
import { AppError } from '../middleware/errorHandler';
import { contactVerificationConfig, verifyContactSubmission } from '../services/contact-verification';
import { isEmailConfigured, sendEmail } from '../utils/email';

const router = Router();

function supportRecipient() {
  const recipient = process.env.SUPPORT_EMAIL?.trim();
  if (!recipient || !isEmailConfigured()) throw new AppError('The contact form is currently unavailable.', 503);
  return recipient;
}

router.get('/config', (_req, res, next) => {
  try {
    supportRecipient();
    const { siteKey } = contactVerificationConfig();
    res.json({ siteKey });
  } catch (error) {
    next(error);
  }
});

router.post('/', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in a few minutes.' }
}), async (req, res, next) => {
  try {
    const { name, email, message, topic = 'contact', turnstileToken } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim() || name.length > 160 ||
      typeof email !== 'string' || email.length > 160 || !/^[^\s@<>(),:;\\"]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(email.trim()) ||
      typeof message !== 'string' || !message.trim() || message.length > 4000 ||
      (topic !== 'contact' && topic !== 'demo')) {
      throw new AppError('Enter a name, valid email and a message up to 4,000 characters.', 400);
    }
    const recipient = supportRecipient();
    await verifyContactSubmission(turnstileToken, topic);
    const enquiry = topic === 'demo' ? 'demo request' : 'website enquiry';
    const replyTo = email.trim();
    try {
      await sendEmail(recipient, `${brand.name} ${enquiry}`, `From ${name.trim()} <${replyTo}>\n\n${message.trim()}`, replyTo);
    } catch {
      throw new AppError('Your message could not be sent. Please try again later.', 503);
    }
    res.json({ message: topic === 'demo' ? 'Your demo request was sent.' : 'Your message was sent.' });
  } catch (error) {
    next(error);
  }
});

export default router;

import { AppError } from '../middleware/errorHandler';

export function contactVerificationConfig() {
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim();
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const hostname = process.env.TURNSTILE_HOSTNAME?.trim().toLowerCase();
  if (!siteKey || !secret || !hostname) throw new AppError('The contact form is currently unavailable.', 503);
  if ((process.env.VERCEL_ENV === 'production' || !process.env.VERCEL_ENV && process.env.NODE_ENV === 'production') &&
      [siteKey, secret].some(key => /^[123]x0{10}/.test(key))) {
    throw new AppError('The contact form is currently unavailable.', 503);
  }
  return { siteKey, secret, hostname };
}

export async function verifyContactSubmission(token: unknown, action: 'contact' | 'demo') {
  if (typeof token !== 'string' || !token.trim() || token.length > 2048) {
    throw new AppError('Complete the security check before submitting.', 400);
  }
  const { secret, hostname } = contactVerificationConfig();
  let verification: { success?: boolean; hostname?: string; action?: string; 'error-codes'?: string[] };
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token }),
      redirect: 'error',
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error('Turnstile service error');
    verification = await response.json() as typeof verification;
    if (!verification || typeof verification.success !== 'boolean' ||
        verification['error-codes']?.some(code => ['internal-error', 'missing-input-secret', 'invalid-input-secret'].includes(code))) {
      throw new Error('Turnstile verification unavailable');
    }
  } catch {
    throw new AppError('The security check is temporarily unavailable. Please try again.', 503);
  }
  if (verification.success !== true || verification.hostname !== hostname || verification.action !== action) {
    throw new AppError('The security check expired or failed. Please complete it again.', 400);
  }
}

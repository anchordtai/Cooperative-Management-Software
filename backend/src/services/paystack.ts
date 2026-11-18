import { createHmac, timingSafeEqual } from 'crypto';
import { AppError } from '../middleware/errorHandler';

const base = 'https://api.paystack.co';

export function testPaystackConfig(cooperativeId?: string) {
  const { PAYSTACK_SECRET_KEY, PAYSTACK_TEST_COOPERATIVE_ID } = process.env;
  if (!PAYSTACK_SECRET_KEY?.startsWith('sk_test_') || !PAYSTACK_TEST_COOPERATIVE_ID ||
    (cooperativeId && cooperativeId !== PAYSTACK_TEST_COOPERATIVE_ID)) return null;
  return { secret: PAYSTACK_SECRET_KEY, cooperativeId: PAYSTACK_TEST_COOPERATIVE_ID };
}

async function request<T>(secret: string, path: string, body?: Record<string, string>): Promise<T> {
  try {
    const response = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(6000),
      redirect: 'error',
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const result = await response.json() as { status: boolean; data: T };
    if (!response.ok || result.status !== true || !result.data) {
      throw new Error('Paystack response failed');
    }
    return result.data;
  } catch {
    throw new AppError('Paystack could not confirm the request', 502);
  }
}

export async function initializePaystack(secret: string, reference: string, email: string, amount: number, callbackUrl: string) {
  const data = await request<{ authorization_url: string; reference: string }>(secret, '/transaction/initialize', {
    email, reference, amount: String(amount), currency: 'NGN', callback_url: callbackUrl
  });
  let checkout: URL;
  try {
    checkout = new URL(data.authorization_url);
  } catch {
    throw new AppError('Invalid Paystack checkout response', 502);
  }
  if (data.reference !== reference || checkout.origin !== 'https://checkout.paystack.com' ||
    checkout.username || checkout.password) throw new AppError('Invalid Paystack checkout response', 502);
  return checkout.href;
}

export interface PaystackVerification {
  reference: string;
  status: string;
  amount: number;
  currency: string;
  domain: string;
}

export const verifyPaystack = (secret: string, reference: string) =>
  request<PaystackVerification>(secret, '/transaction/verify/' + encodeURIComponent(reference));

function matchingDigest(expected: Buffer, supplied: string) {
  return /^[a-f0-9]{128}$/.test(supplied) && timingSafeEqual(expected, Buffer.from(supplied, 'hex'));
}

export function validPaystackSignature(
  raw: Buffer, legacyHeader: string | undefined, signedHeader: string | undefined,
  secret: string, signingSecrets: string[], now = Math.floor(Date.now() / 1000)
) {
  if (signedHeader && signingSecrets.length > 0) {
    const parts = signedHeader.split(',').map(part => part.trim());
    const times = parts.filter(part => part.startsWith('t='));
    if (times.length !== 1) return false;
    const timestamp = times[0].slice(2);
    if (!/^\d{1,12}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 300) return false;
    const signatures = parts.map(part => part.match(/^v1=whk_[a-z0-9]+:([a-f0-9]{128})$/)?.[1])
      .filter((value): value is string => Boolean(value));
    return signingSecrets.some(key => {
      const expected = createHmac('sha512', key).update(timestamp + '.').update(raw).digest();
      return signatures.some(signature => matchingDigest(expected, signature));
    });
  }
  if (!legacyHeader) return false;
  return matchingDigest(createHmac('sha512', secret).update(raw).digest(), legacyHeader);
}

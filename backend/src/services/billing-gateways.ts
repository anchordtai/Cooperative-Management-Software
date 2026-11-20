import { AppError } from '../middleware/errorHandler';
import { money, toMinorUnits } from './finance';

export type Gateway = 'paystack' | 'flutterwave';
export type Mode = 'test' | 'live';
export const paymentMode = (): Mode => process.env.SAAS_PAYMENT_MODE === 'live' ? 'live' : 'test';

function secretFor(gateway: Gateway) {
  if (process.env.SAAS_PAYMENT_MODE !== 'live' && process.env.SAAS_PAYMENT_MODE !== 'test') return '';
  if ((process.env.VERCEL_ENV || process.env.NODE_ENV) === 'production' && paymentMode() !== 'live') return '';
  const live = paymentMode() === 'live';
  if (live && (process.env.VERCEL_ENV || process.env.NODE_ENV) !== 'production') return '';
  if (gateway === 'paystack') {
    const secret = process.env.SAAS_PAYSTACK_SECRET_KEY || '';
    return secret.startsWith(live ? 'sk_live_' : 'sk_test_') ? secret : '';
  }
  const secret = process.env.SAAS_FLUTTERWAVE_SECRET_KEY || '';
  return (live ? /^FLWSECK-(?!TEST-).+/.test(secret) : secret.startsWith('FLWSECK_TEST-')) &&
    /^\d+$/.test(process.env.SAAS_FLUTTERWAVE_ACCOUNT_ID || '') ? secret : '';
}

export const availableGateways = () => (['paystack', 'flutterwave'] as const).filter(gateway => secretFor(gateway));

async function request(gateway: Gateway, path: string, body?: object) {
  const secret = secretFor(gateway);
  if (!secret) throw new AppError('This billing gateway is not configured.', 503);
  const host = gateway === 'paystack' ? 'https://api.paystack.co' : 'https://api.flutterwave.com';
  try {
    const response = await fetch(host + path, {
      redirect: 'error', signal: AbortSignal.timeout(8000), method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!response.ok) throw new Error('Gateway unavailable');
    const payload = await response.json() as { status: unknown; data?: Record<string, any> };
    if (payload.status !== (gateway === 'paystack' ? true : 'success') || !payload.data) throw new Error('Gateway unavailable');
    return payload.data;
  } catch {
    throw new AppError('The billing gateway could not complete the request. Try again shortly.', 502);
  }
}

export async function initialize(gateway: Gateway, email: string, reference: string, amount: number) {
  const origin = new URL(process.env.FRONTEND_URL || 'http://localhost:3000').origin;
  if (paymentMode() === 'live' && !origin.startsWith('https://')) throw new AppError('Set the public HTTPS billing callback origin.', 503);
  const callback = `${origin}/billing?checkout=${reference}`;
  const data = gateway === 'paystack'
    ? await request(gateway, '/transaction/initialize', { reference, email, amount, currency: 'NGN', callback_url: callback })
    : await request(gateway, '/v3/payments', { tx_ref: reference, amount: money(amount), currency: 'NGN',
      redirect_url: callback, customer: { email } });
  const raw = gateway === 'paystack' ? data.authorization_url : data.link;
  const hosts = gateway === 'paystack' ? ['checkout.paystack.com'] : ['checkout.flutterwave.com'];
  let url: URL;
  try { url = new URL(raw); } catch { throw new AppError('The gateway returned an invalid checkout link.', 502); }
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !hosts.includes(url.hostname) ||
      (gateway === 'paystack' && data.reference !== reference)) {
    throw new AppError('The gateway returned an invalid checkout link.', 502);
  }
  return url.toString();
}

export async function verifyGateway(gateway: Gateway, reference: string, amount: number, mode: Mode) {
  if (mode !== paymentMode()) throw new AppError('This payment was initiated in a different gateway environment.', 409);
  const data = gateway === 'paystack'
    ? await request(gateway, '/transaction/verify/' + encodeURIComponent(reference))
    : await request(gateway, '/v3/transactions/verify_by_reference?tx_ref=' + encodeURIComponent(reference));
  const expectedReference = gateway === 'paystack' ? data.reference : data.tx_ref;
  if (expectedReference !== reference) throw new AppError('The provider returned a different payment reference.', 409);
  const success = gateway === 'paystack' ? 'success' : 'successful';
  if (data.status !== success) {
    if (data.status === 'failed' || data.status === 'abandoned' || data.status === 'cancelled') return { status: 'failed' as const };
    return { status: 'pending' as const };
  }
  const minor = gateway === 'paystack' ? data.amount : toMinorUnits(data.amount);
  const id = typeof data.id === 'string' ? data.id : Number.isSafeInteger(data.id) ? String(data.id) : '';
  if (data.currency !== 'NGN' || minor !== amount || !/^\d{1,25}$/.test(id) ||
      (gateway === 'paystack' ? data.domain !== mode : String(data.account_id) !== process.env.SAAS_FLUTTERWAVE_ACCOUNT_ID)) {
    throw new AppError('The verified payment does not match the expected amount, currency or merchant.', 409);
  }
  return { status: 'paid' as const, id };
}

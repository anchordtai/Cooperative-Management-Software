import { createHash } from 'node:crypto';

export const ownerRole = 'platform_owner';
export const ownerEmail = () => process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase() || '';
export const internalOwnerDomain = '@coopsphere.invalid';

// The tenant and platform credentials have separate user rows even when they
// share a mailbox. The internal identifier is never used to deliver mail.
export const ownerAccountId = (email: string) => createHash('sha256').update(email).digest('hex') + internalOwnerDomain;

export function isConfiguredOwner(user: { role: string; email: string; cooperativeId: string | null; twoFAEnabled: boolean }) {
  const email = ownerEmail();
  return Boolean(email && user.role === ownerRole && user.email === ownerAccountId(email) &&
    user.cooperativeId === null && user.twoFAEnabled);
}

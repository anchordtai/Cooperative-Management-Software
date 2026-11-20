export const ownerRole = 'platform_owner';
export const ownerEmail = () => process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase() || '';

export function isConfiguredOwner(user: { role: string; email: string; cooperativeId: string | null; twoFAEnabled: boolean }) {
  const email = ownerEmail();
  return Boolean(email && user.role === ownerRole && user.email === email && user.cooperativeId === null && user.twoFAEnabled);
}

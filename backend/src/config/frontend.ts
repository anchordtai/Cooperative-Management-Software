function origin(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Frontend URLs must be HTTP or HTTPS origins without a path or credentials');
  }
  return url.origin;
}

export const frontendUrl = () => origin(process.env.FRONTEND_URL || 'http://localhost:3000');

export function allowedFrontendOrigins() {
  const aliases = (process.env.FRONTEND_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  const vercelHosts = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL];
  const vercelOrigins = process.env.VERCEL === '1' ? vercelHosts.filter(Boolean).map(host => `https://${host}`) : [];
  return new Set([frontendUrl(), ...aliases.map(origin), ...vercelOrigins.map(origin)]);
}

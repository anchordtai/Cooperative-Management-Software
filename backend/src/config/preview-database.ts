function parsePostgresUrl(value: string, key: string): URL {
  let url: URL | undefined;
  try { url = new URL(value); } catch { /* Report the variable name without its credential. */ }
  if (!url || !['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) {
    throw new Error(key + ' must be a PostgreSQL connection URL.');
  }
  return url;
}

export function previewDatabaseUrl(env: NodeJS.ProcessEnv): string | undefined {
  if (!env.SAAS_STAGING_DATABASE_URL) return undefined;

  const staging = parsePostgresUrl(env.SAAS_STAGING_DATABASE_URL, 'SAAS_STAGING_DATABASE_URL');
  const endpoint = (url: URL) => url.hostname.toLowerCase().replace(/\.$/, '').replace(/-pooler(?=\.)/, '');
  for (const key of ['DATABASE_URL', 'DATABASE_URL_UNPOOLED']) {
    const inherited = env[key];
    if (inherited && endpoint(staging) === endpoint(parsePostgresUrl(inherited, key))) {
      throw new Error('The staging database must use a separate PostgreSQL endpoint.');
    }
  }

  staging.searchParams.set('sslmode', 'verify-full');
  return staging.toString();
}

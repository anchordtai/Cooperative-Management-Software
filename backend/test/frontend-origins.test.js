const assert = require('node:assert/strict');
const { once } = require('node:events');
const { test } = require('node:test');

test('canonical and transition origins can use the API without accepting unrelated origins', async t => {
  const original = process.env;
  const canonical = 'https://coopsphere.megastride.com.ng';
  const legacy = 'https://cooperative-management-software.vercel.app';
  process.env = { ...original, FRONTEND_URL: canonical + '/', FRONTEND_ALLOWED_ORIGINS: ' ' + legacy + ', ',
    VERCEL: '0', VERCEL_URL: '' };
  t.after(() => { process.env = original; });

  const { frontendUrl } = require('../dist/config/frontend');
  const app = require('../dist/app').default;
  const server = app.listen(0, '127.0.0.1');
  t.after(() => server.close());
  await once(server, 'listening');
  const endpoint = 'http://127.0.0.1:' + server.address().port + '/api/auth/register';
  assert.equal(frontendUrl(), canonical);

  for (const origin of [canonical, legacy, 'https://example.test']) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json', 'x-ecooperative-request': '1' },
      body: '{}'
    });
    const allowed = origin === canonical || origin === legacy;
    assert.equal(response.status, allowed ? 400 : 403);
    assert.equal(response.headers.get('access-control-allow-origin'), allowed ? origin : null);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

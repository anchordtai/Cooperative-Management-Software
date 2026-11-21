const assert = require('node:assert/strict');
const { once } = require('node:events');
const { test } = require('node:test');
const nodemailer = require('nodemailer');

test('contact and demo require a valid single-use Turnstile token before sending email', async t => {
  const original = process.env;
  process.env = { ...original, NODE_ENV: 'test', SUPPORT_EMAIL: 'support@example.test',
    SMTP_HOST: 'smtp.example.test', SMTP_USER: 'mailer', SMTP_PASS: 'smtp-fixture',
    SMTP_FROM: 'sender@example.test' };
  delete process.env.TURNSTILE_SITE_KEY;
  t.after(() => { process.env = original; });

  const sent = [];
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async email => { sent.push(email); } }));
  const fetchHttp = global.fetch;
  const used = new Set();
  let siteverifyCalls = 0;
  t.mock.method(global, 'fetch', async (url, options) => {
    assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.equal(options.redirect, 'error');
    assert.equal(options.body.get('secret'), 'server-only-fixture');
    siteverifyCalls++;
    const token = options.body.get('response');
    if (token === 'outage') throw new Error('Network unavailable');
    if (used.has(token)) return Response.json({ success: false, 'error-codes': ['timeout-or-duplicate'] });
    used.add(token);
    return Response.json({ success: token !== 'forged',
      hostname: token === 'wrong-host' ? 'unrelated.example.test' : 'staging.example.test',
      action: token === 'valid-contact' ? 'contact' : 'demo' });
  });
  const app = require('../dist/app').default;
  const server = app.listen(0, '127.0.0.1');
  t.after(() => server.close());
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port + '/api/contact';
  const post = (token, topic = 'demo') => fetchHttp(base, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-ECooperative-Request': '1' },
    body: JSON.stringify({ name: ' Demo User ', email: ' user@example.test ', message: 'Show me the platform.',
      topic, turnstileToken: token })
  });

  assert.equal((await fetchHttp(base + '/config')).status, 503);
  Object.assign(process.env, { TURNSTILE_SITE_KEY: 'public-fixture', TURNSTILE_SECRET_KEY: 'server-only-fixture',
    TURNSTILE_HOSTNAME: 'staging.example.test' });
  assert.deepEqual(await (await fetchHttp(base + '/config')).json(), { siteKey: 'public-fixture' });
  const { verifyContactSubmission } = require('../dist/services/contact-verification');
  await assert.rejects(verifyContactSubmission('outage', 'demo'), { statusCode: 503 });
  await assert.rejects(verifyContactSubmission('forged', 'demo'), { statusCode: 400 });
  assert.equal((await post(undefined)).status, 400);
  assert.equal((await post('wrong-host')).status, 400);
  assert.equal((await post('wrong-action', 'contact')).status, 400);
  assert.equal(sent.length, 0);
  const result = await post('valid-demo');
  assert.equal(result.status, 200);
  assert.equal((await result.json()).message, 'Your demo request was sent.');
  assert.equal((await post('valid-demo')).status, 400);
  assert.equal((await post('another-attempt')).status, 429);
  assert.equal(siteverifyCalls, 6);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'support@example.test');
  assert.equal(sent[0].replyTo, 'user@example.test');
  assert.match(sent[0].subject, /demo request$/);
  assert.match(sent[0].text, /From Demo User <user@example.test>\n\nShow me the platform\./);
  process.env.NODE_ENV = 'production';
  process.env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';
  assert.equal((await fetchHttp(base + '/config')).status, 503);
});

const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { test } = require('node:test');

test('platform owner activates privately, verifies each sign-in and controls tenant access', async t => {
  assert.equal(process.env.ECOOPERATIVE_TEST_DATABASE, '1');
  const original = process.env;
  const email = 'owner@example.test';
  process.env = { ...original, PLATFORM_OWNER_EMAIL: email, JWT_SECRET: randomBytes(32).toString('hex'),
    SMTP_HOST: 'smtp.example.test', SMTP_FROM: 'sender@example.test', SMTP_USER: 'test', SMTP_PASS: 'test' };
  t.after(() => { process.env = original; });

  for (const expected of ['Platform owner provisioned', 'Platform owner already provisioned']) {
    const run = spawnSync(process.execPath, ['dist/provision-owner.js'], { env: process.env, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, new RegExp(expected));
  }

  const mail = [];
  t.mock.method(require('nodemailer'), 'createTransport', () => ({
    sendMail: async ({ to, text }) => { mail.push({ to, text }); }
  }));
  const sequelize = require('../dist/config/database').default;
  const { User } = require('../dist/models/User');
  const Cooperative = require('../dist/models/Cooperative').default;
  const app = require('../dist/app').default;
  const server = app.listen(0, '127.0.0.1');
  t.after(async () => { server.close(); await sequelize.close(); });
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const client = () => {
    const cookies = new Map();
    return async (url, method = 'GET', data, status = 200) => {
      const response = await fetch(base + url, {
        method, body: data === undefined ? undefined : JSON.stringify(data),
        headers: { 'content-type': 'application/json', 'x-ecooperative-request': '1',
          cookie: [...cookies].map(([name, value]) => name + '=' + value).join('; ') }
      });
      for (const cookie of response.headers.getSetCookie()) {
        const [pair] = cookie.split(';');
        const index = pair.indexOf('=');
        cookies.set(pair.slice(0, index), pair.slice(index + 1));
      }
      const json = await response.json();
      assert.equal(response.status, status, JSON.stringify(json));
      return json;
    };
  };

  const owner = client();
  const tenant = client();
  const cooperative = await Cooperative.create({ name: 'Owner test cooperative' });
  const tenantEmail = randomUUID() + '@example.test';
  const password = 'Example password 19!';
  await User.create({ email: tenantEmail, password, role: 'admin', cooperativeId: cooperative.id,
    phone: '08000000000', isEmailVerified: true });
  await tenant('/auth/login', 'POST', { email: tenantEmail, password });
  await tenant('/platform/tenants', 'GET', undefined, 403);
  await client()('/platform/tenants', 'GET', undefined, 401);

  await owner('/auth/forgot-password', 'POST', { email });
  assert.equal(mail.at(-1).to, email);
  const token = mail.at(-1).text.match(/#token=([0-9a-f]{64})/)[1];
  await owner('/auth/reset-password', 'POST', { password, token });
  await owner('/auth/reset-password', 'POST', { password, token }, 400);

  const login = await owner('/auth/login', 'POST', { email, password });
  assert.equal(login.require2FA, true);
  await owner('/platform/tenants', 'GET', undefined, 401);
  assert.equal(mail.at(-1).to, email);
  const code = mail.at(-1).text.match(/^\d{6}/)[0];
  await owner('/auth/verify-2fa', 'POST', { email, code });
  const account = (await owner('/auth/me')).user;
  assert.equal(account.role, 'platform_owner');
  assert.equal(account.cooperativeId, null);
  await owner('/members', 'GET', undefined, 403);
  await owner('/transactions', 'GET', undefined, 403);
  const directory = await owner('/platform/tenants?limit=100');
  assert(directory.data.some(row => row.id === cooperative.id && row.suspendedAt === null));

  const status = '/platform/tenants/' + cooperative.id + '/status';
  await tenant(status, 'PATCH', { status: 'suspended' }, 403);
  await owner(status, 'PATCH', { status: 'suspended' });
  await owner(status, 'PATCH', { status: 'suspended' });
  await tenant('/auth/me', 'GET', undefined, 401);
  await tenant('/auth/login', 'POST', { email: tenantEmail, password }, 403);
  await owner(status, 'PATCH', { status: 'active' });
  await tenant('/auth/refresh-token', 'POST', {}, 401);
  await tenant('/auth/login', 'POST', { email: tenantEmail, password });
  const audit = (await owner('/platform/audit')).data.filter(row => row.cooperativeId === cooperative.id);
  assert.deepEqual(audit.map(row => row.action), ['tenant.reactivated', 'tenant.suspended']);
});

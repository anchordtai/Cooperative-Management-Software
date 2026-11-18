const assert = require('node:assert/strict');
const { createHmac, randomBytes, randomUUID } = require('node:crypto');
const { resolve } = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { test } = require('node:test');
const sequelize = require('../dist/config/database').default;
const Cooperative = require('../dist/models/Cooperative').default;
const Member = require('../dist/models/Member').default;
const { User } = require('../dist/models/User');

test('verified test checkout and concurrent webhooks post one deposit', { timeout: 30000 }, async t => {
  assert.equal(process.env.ECOOPERATIVE_TEST_DATABASE, '1', 'Use a dedicated test database');
  const cooperative = await Cooperative.create({ name: 'Paystack test cooperative' });
  const otherCooperative = await Cooperative.create({ name: 'Paystack test control' });
  const password = 'Local provider fixture password!';
  async function seedMember(parent) {
    const email = randomUUID() + '@example.test';
    const user = await User.create({
      email, password, role: 'member', cooperativeId: parent.id, phone: '08012345678', isEmailVerified: true
    });
    return Member.create({
      userId: user.id, cooperativeId: parent.id, email, phone: '08012345678',
      firstName: 'Test', lastName: 'Member', address: 'Abuja', membershipNumber: randomUUID(), status: 'active'
    });
  }
  const member = await seedMember(cooperative);
  const otherMember = await seedMember(otherCooperative);

  const port = process.env.TEST_PAYMENTS_PORT || '55436';
  const base = 'http://127.0.0.1:' + port;
  const secret = 'sk_test_local_provider_fixture';
  const api = spawn(process.execPath, ['--require', resolve('test/fixtures/paystack-stub.cjs'), 'dist/index.js'], {
    stdio: 'ignore',
    env: {
      ...process.env, PORT: port, JWT_SECRET: randomBytes(32).toString('hex'),
      PAYSTACK_SECRET_KEY: secret, PAYSTACK_TEST_COOPERATIVE_ID: cooperative.id
    }
  });
  t.after(async () => {
    api.kill();
    await sequelize.close();
  });
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await fetch(base + '/health').then(result => result.ok).catch(() => false)) break;
    await delay(100);
  }
  async function call(path, cookie, method = 'GET', body) {
    return fetch(base + '/api' + path, {
      method,
      headers: { cookie, 'content-type': 'application/json', 'x-ecooperative-request': '1' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  }
  async function login(email) {
    const response = await call('/auth/login', '', 'POST', { email, password });
    assert.equal(response.status, 200);
    return response.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ');
  }

  const cookie = await login(member.email);
  const other = await login(otherMember.email);
  const config = await call('/payments/config', other);
  assert.equal((await config.json()).data.testDeposits, false);
  assert.equal((await call('/payments/deposit', other, 'POST', { amount: '200.50' })).status, 503);

  const checkout = await call('/payments/deposit', cookie, 'POST', { amount: '200.50' });
  assert.equal(checkout.status, 201);
  const { reference } = (await checkout.json()).data;
  assert.equal((await member.reload()).savings, '0.00');
  assert.equal((await call(`/payments/${reference}/verify`, other, 'POST')).status, 404);

  const hook = JSON.stringify({ event: 'charge.success', data: { reference } });
  const digest = createHmac('sha512', secret).update(hook).digest('hex');
  const webhook = signature => fetch(base + '/api/webhooks/paystack', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-paystack-signature': signature }, body: hook
  });
  assert.equal((await webhook('invalid')).status, 401);
  const results = await Promise.all([
    call(`/payments/${reference}/verify`, cookie, 'POST'), webhook(digest), webhook(digest)
  ]);
  assert(results.every(result => result.status === 200));
  assert.equal((await member.reload()).savings, '200.50');
  const [entries] = await sequelize.query(`SELECT count(*) FROM "Transactions" WHERE "externalReference" = :reference`,
    { replacements: { reference } });
  assert.equal(entries[0].count, '1');

  const mismatch = await call('/payments/deposit', cookie, 'POST', { amount: '201.50' });
  assert.equal(mismatch.status, 201);
  const mismatchedReference = (await mismatch.json()).data.reference;
  assert.equal((await call(`/payments/${mismatchedReference}/verify`, cookie, 'POST')).status, 409);
  assert.equal((await member.reload()).savings, '200.50');
});

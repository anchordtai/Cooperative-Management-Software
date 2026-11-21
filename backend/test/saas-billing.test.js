const assert = require('node:assert/strict');
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
const { once } = require('node:events');
const { test } = require('node:test');

test('tenant checkout, verification, capacity and import preserve subscription isolation', async t => {
  assert.equal(process.env.ECOOPERATIVE_TEST_DATABASE, '1');
  const originalEnv = process.env;
  process.env = { ...originalEnv, JWT_SECRET: randomBytes(32).toString('hex'), SAAS_ENFORCE_SUBSCRIPTIONS: 'true',
    SAAS_PAYMENT_MODE: 'test', SAAS_PAYSTACK_SECRET_KEY: 'sk_test_local_billing_fixture',
    SAAS_FLUTTERWAVE_SECRET_KEY: 'FLWSECK_TEST-local-billing-fixture', SAAS_FLUTTERWAVE_ACCOUNT_ID: '44',
    SAAS_FLUTTERWAVE_WEBHOOK_HASH: 'local-flutterwave-hash', VERCEL_ENV: '' };
  t.after(() => { process.env = originalEnv; });
  const app = require('../dist/app').default;
  const sequelize = require('../dist/config/database').default;
  const Cooperative = require('../dist/models/Cooperative').default;
  const { User } = require('../dist/models/User');
  const profile = { name: 'Billing fixture', cooperativeType: 'Staff cooperative', address: 'Abuja', state: 'FCT',
    country: 'Nigeria', email: 'billing@example.test', phone: '08000000000', registrationNumber: '', establishedOn: '', description: '' };
  const tenant = await Cooperative.create({ name: profile.name });
  const outsideTenant = await Cooperative.create({ name: 'Second billing tenant' });
  const password = 'Fixture Billing Password!';
  const user = async cooperativeId => User.create({
    cooperativeId, role: 'admin', email: randomUUID() + '@example.test', password, phone: '08000000000', isEmailVerified: true
  });
  const admin = await user(tenant.id);
  const outsider = await user(outsideTenant.id);
  await sequelize.query(`UPDATE "SubscriptionPlans" SET "monthlyMinor" = 12345, "annualMinor" = 111111,
    "maximumMembers" = 1, "graceDays" = 3 WHERE slug = 'seed'`);
  t.after(async () => {
    await sequelize.query(`UPDATE "SubscriptionPlans" SET "monthlyMinor" = 750000, "annualMinor" = 7500000,
      "maximumMembers" = 100, "graceDays" = 0 WHERE slug = 'seed'`);
    await sequelize.query(`UPDATE "BillingGatewayControls" SET paused = false WHERE gateway = 'paystack'`);
    await sequelize.close();
  });
  const nativeFetch = global.fetch;
  const remote = new Map();
  let wrongAmount = false;
  let wrongCurrency = false;
  let wrongMerchant = false;
  let undercharged = false;
  let wrongReference = false;
  t.mock.method(global, 'fetch', async (url, options = {}) => {
    if (typeof url !== 'string' || !/^https:\/\/api\.(paystack\.co|flutterwave\.com)\//.test(url)) return nativeFetch(url, options);
    const paystack = url.includes('paystack.co');
    assert.equal(options.headers.Authorization, 'Bearer ' + (paystack ? process.env.SAAS_PAYSTACK_SECRET_KEY : process.env.SAAS_FLUTTERWAVE_SECRET_KEY));
    if (options.method === 'POST') {
      const data = JSON.parse(options.body);
      const reference = data.reference || data.tx_ref;
      remote.set(reference, { data, state: 'paid', id: String(1000 + remote.size) });
      return Response.json({ status: paystack ? true : 'success', data: paystack
        ? { reference, authorization_url: 'https://checkout.paystack.com/demo' }
        : { link: 'https://checkout.flutterwave.com/demo' } });
    }
    const parsed = new URL(url);
    const reference = paystack ? parsed.pathname.split('/').at(-1) : parsed.searchParams.get('tx_ref');
    const checkout = remote.get(reference);
    if (!checkout) return new Response('', { status: 404 });
    const { data, state, id } = checkout;
    const status = state === 'paid' ? (paystack ? 'success' : 'successful') : state;
    return Response.json({ status: paystack ? true : 'success', data: {
      reference: wrongReference ? 'different' : reference, tx_ref: reference, status, id,
      domain: 'test', account_id: wrongMerchant ? '95' : '44', currency: wrongCurrency ? 'USD' : 'NGN',
      amount: wrongAmount ? Number(data.amount) + 1 : data.amount,
      charged_amount: undercharged ? '1.00' : data.amount
    } });
  });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => server.close());
  await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  const client = login => {
    let cookies = '';
    return async (path, method = 'GET', body, status = 200, extraHeaders = {}) => {
      const response = await nativeFetch(origin + '/api' + path, {
        method, headers: { cookie: cookies, 'content-type': 'application/json', 'x-ecooperative-request': '1', ...extraHeaders },
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
      });
      const type = response.headers.get('content-type') || '';
      const value = type.includes('json') ? await response.json() : await response.text();
      assert.equal(response.status, status, path + ' ' + JSON.stringify(value).slice(0, 500));
      if (login && response.headers.getSetCookie().length) cookies = response.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
      return value;
    };
  };
  const a = client(true);
  const b = client(true);
  const webhook = client(false);
  await a('/auth/login', 'POST', { email: admin.email, password });
  await b('/auth/login', 'POST', { email: outsider.email, password });
  assert.deepEqual((await a('/billing/plans')).data.map(plan => plan.name), ['Seed', 'Growth', 'Scale', 'Enterprise', 'Enterprise Plus']);
  const plans = (await a('/billing/plans')).data;
  for (const [slug, amount] of [['growth', '1500000'], ['scale', '2500000'], ['enterprise', '4000000']]) {
    const plan = plans.find(row => row.slug === slug);
    assert.equal(plan.monthlyMinor, amount);
    assert.equal(plan.annualMinor, String(Number(amount) * 10));
    assert.equal(typeof plan.trialDays, 'number');
  }
  assert.equal((await a('/billing')).data.allowed, false);
  await a('/members', 'GET', undefined, 402);
  await a('/platform/billing/plans', 'GET', undefined, 403);
  const draft = { plan: 'seed', cycle: 'monthly', gateway: 'paystack', expectedMinor: '12345' };
  await a('/billing/checkout', 'POST', draft, 409);
  await a('/billing/profile', 'PUT', profile);
  await a('/billing/checkout', 'POST', { ...draft, expectedMinor: '1' }, 409);
  const { reference } = (await a('/billing/checkout', 'POST', draft, 201)).data;
  await a('/billing/checkout', 'POST', { ...draft, gateway: 'flutterwave' }, 409);
  assert.equal(remote.size, 1);
  await sequelize.query(`UPDATE "BillingGatewayControls" SET paused = true WHERE gateway = 'paystack'`);
  await a('/billing/checkout', 'POST', draft, 503);
  const check = '/billing/verify/' + reference;
  await b(check, 'POST', {}, 404);
  wrongAmount = true;
  await a(check, 'POST', {}, 409);
  wrongAmount = false;
  wrongCurrency = true;
  await a(check, 'POST', {}, 409);
  wrongCurrency = false;
  wrongReference = true;
  await a(check, 'POST', {}, 409);
  wrongReference = false;
  const payload = JSON.stringify({ event: 'charge.success', data: { reference } });
  await webhook('/billing/webhooks/paystack', 'POST', payload, 401);
  const signature = createHmac('sha512', process.env.SAAS_PAYSTACK_SECRET_KEY).update(payload).digest('hex');
  const signingKey = 'whsec_current_billing_fixture';
  process.env.SAAS_PAYSTACK_WEBHOOK_SECRET = signingKey;
  await webhook('/billing/webhooks/paystack', 'POST', payload, 401, { 'x-paystack-signature': signature });
  const signed = at => 't=' + at + ',v1=whk_fixture:' + createHmac('sha512', signingKey).update(at + '.').update(payload).digest('hex');
  const timestamp = Math.floor(Date.now() / 1000);
  await webhook('/billing/webhooks/paystack', 'POST', payload, 401, { 'paystack-signature': signed(timestamp - 301) });
  await webhook('/billing/webhooks/paystack', 'POST', payload, 200, { 'paystack-signature': signed(timestamp) });
  await webhook('/billing/webhooks/paystack', 'POST', payload, 200, { 'paystack-signature': signed(timestamp) });
  assert.equal((await a(check, 'POST', {})).data.status, 'paid');
  await sequelize.query(`UPDATE "BillingGatewayControls" SET paused = false WHERE gateway = 'paystack'`);
  const active = (await a('/billing')).data;
  assert.equal(active.term.status, 'active');
  assert.equal(active.maximum, 1);
  assert.equal(active.allowed, true);
  assert.equal((await b('/billing')).data.term, null);
  assert.match(await a('/billing/receipt/' + reference), /^%PDF/);
  await b('/billing/receipt/' + reference, 'GET', undefined, 404);

  const member = (value, phone) => ({ firstName: 'Ada', lastName: 'Test', email: value, phone, address: 'Abuja' });
  const rows = [member('ada@example.test', '08000001001'), member('ada@example.test', '08000001001'), member('b@example.test', '08000001002')];
  const preview = (await a('/members/import/preview', 'POST', { rows })).data;
  assert.deepEqual(preview.rows.map(row => row.status), ['valid', 'duplicate', 'valid']);
  const batch = { rows, requestId: randomUUID(), acceptPartial: false };
  await a('/members/import/confirm', 'POST', batch, 409);
  const confirmed = { ...batch, acceptPartial: true };
  const [first, replay] = await Promise.all([
    a('/members/import/confirm', 'POST', confirmed, 201),
    a('/members/import/confirm', 'POST', confirmed, 201)
  ]);
  assert.deepEqual(first.data, replay.data);
  assert.equal(first.data.created, 1);
  assert.deepEqual(first.data.rows.map(row => row.status), ['created', 'duplicate', 'capacity']);
  await a('/members', 'POST', member('c@example.test', '08000001003'), 409);
  assert.equal((await a('/members/import/history')).data.length, 1);
  await b('/members/import/history', 'GET', undefined, 402);

  const renewal = (await a('/billing/checkout', 'POST', { ...draft, gateway: 'flutterwave' }, 201)).data.reference;
  const renewalPath = '/billing/verify/' + renewal;
  wrongMerchant = true;
  await a(renewalPath, 'POST', {}, 409);
  wrongMerchant = false;
  undercharged = true;
  await a(renewalPath, 'POST', {}, 409);
  undercharged = false;
  const notification = JSON.stringify({ event: 'charge.completed', data: { tx_ref: renewal } });
  remote.get(renewal).state = 'pending';
  await webhook('/billing/webhooks/flutterwave', 'POST', notification, 503, { 'verif-hash': 'local-flutterwave-hash' });
  assert.equal((await a(renewalPath, 'POST', {})).data.status, 'pending');
  remote.get(renewal).state = 'failed';
  assert.equal((await a(renewalPath, 'POST', {})).data.status, 'failed');
  remote.get(renewal).state = 'paid';
  await webhook('/billing/webhooks/flutterwave', 'POST', notification, 200, { 'verif-hash': 'local-flutterwave-hash' });
  assert.equal((await a(renewalPath, 'POST', {})).data.status, 'paid');
  assert(new Date((await a('/billing')).data.term.endsAt) > new Date(active.term.endsAt));
  const suspended = (await a('/billing/checkout', 'POST', { ...draft, gateway: 'flutterwave' }, 201)).data.reference;
  await tenant.update({ suspendedAt: new Date() });
  await webhook('/billing/webhooks/flutterwave', 'POST',
    JSON.stringify({ event: 'charge.completed', data: { tx_ref: suspended } }), 200,
    { 'verif-hash': 'local-flutterwave-hash' });
  const [review] = await sequelize.query(`SELECT status FROM "SubscriptionPayments" WHERE reference = :reference`,
    { replacements: { reference: suspended }, type: 'SELECT' });
  assert.equal(review.status, 'review');
  await tenant.update({ suspendedAt: null });
  await a('/billing/cancel-at-expiry', 'POST', {});
  await sequelize.query(`UPDATE "CooperativeSubscriptions" SET "startsAt" = now() - interval '36 days',
    "endsAt" = now() - interval '1 day' WHERE "cooperativeId" = :cooperativeId`, { replacements: { cooperativeId: tenant.id } });
  assert.equal((await a('/billing')).data.term.status, 'cancelled');
  await a('/members', 'GET', undefined, 402);
});

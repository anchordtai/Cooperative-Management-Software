const assert = require('node:assert/strict');
const { createHash, randomUUID, randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { test } = require('node:test');
const sequelize = require('../dist/config/database').default;
const { User } = require('../dist/models/User');

function client(base) {
  const cookies = new Map();
  const request = async (path, method = 'GET', body, status = 200, headers = {}) => {
    const result = await fetch(base + '/api' + path, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-ecooperative-request': '1',
        cookie: [...cookies].map(([key, value]) => key + '=' + value).join('; '),
        ...headers
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    for (const cookie of result.headers.getSetCookie()) {
      const pair = cookie.split(';', 1)[0];
      const equal = pair.indexOf('=');
      cookies.set(pair.slice(0, equal), pair.slice(equal + 1));
    }
    const json = result.status === 204 ? null : await result.json();
    assert.equal(result.status, status, path + ' returned ' + JSON.stringify(json));
    return json;
  };
  return { request, cookies };
}

test('onboarding, rotating sessions, member approval, and cooperative isolation', { timeout: 35000 }, async t => {
  assert.equal(process.env.ECOOPERATIVE_TEST_DATABASE, '1', 'Use a dedicated test database');
  const port = process.env.TEST_PORT || '55433';
  const base = 'http://127.0.0.1:' + port;
  const server = spawn(process.execPath, ['dist/index.js'], {
    env: { ...process.env, PORT: port, SMTP_HOST: '', JWT_SECRET: randomBytes(32).toString('hex') },
    stdio: 'ignore'
  });
  t.after(async () => {
    server.kill();
    await sequelize.close();
  });

  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    ready = await fetch(base + '/health').then(response => response.ok).catch(() => false);
    if (ready) break;
    await delay(100);
  }
  assert.equal(ready, true, 'API should become ready');

  const password = 'Cooperative test password 42!';
  const suffix = randomUUID();
  const adminA = client(base);
  const adminB = client(base);
  const memberClient = client(base);

  async function loginDetails(account, name) {
    const email = name.toLowerCase() + suffix + '@example.test';
    const registration = { email, password, cooperativeName: name, firstName: 'Test', lastName: name, phone: '08012345678', role: 'staff' };
    const created = await account.request('/auth/register', 'POST', registration, 201);
    assert.equal(created.data.delivered, false);
    await account.request('/auth/login', 'POST', { email, password }, 403);

    // Provision a known verification token in the disposable database so the
    // endpoint can be tested without using a production email provider.
    const token = randomBytes(32).toString('hex');
    await User.update({
      emailVerificationToken: createHash('sha256').update(token).digest('hex'),
      emailVerificationExpires: new Date(Date.now() + 60000)
    }, { where: { email } });
    await account.request('/auth/verify-email', 'POST', { token });
    await account.request('/auth/verify-email', 'POST', { token }, 400);
    const result = await account.request('/auth/login', 'POST', { email, password });
    assert.equal(result.data.user.role, 'admin');
    return result.data.user;
  }

  const userA = await loginDetails(adminA, 'Alpha');
  const userB = await loginDetails(adminB, 'Beta');
  assert.notEqual(userA.cooperativeId, userB.cooperativeId);

  const originalRefresh = adminA.cookies.get('refresh');
  await adminA.request('/auth/refresh-token', 'POST');
  assert.notEqual(adminA.cookies.get('refresh'), originalRefresh);
  const stale = client(base);
  stale.cookies.set('refresh', originalRefresh);
  await stale.request('/auth/refresh-token', 'POST', undefined, 401);
  assert.equal((await adminA.request('/auth/me')).user.id, userA.id);

  const email = 'member' + suffix + '@example.test';
  const member = (await adminA.request('/members', 'POST', {
    firstName: 'Sample', lastName: 'Member', email, phone: '08012345678', address: 'Abuja'
  }, 201)).data;
  assert.equal(member.status, 'inactive');
  await adminB.request('/members/' + member.id, 'GET', undefined, 404);
  await adminB.request('/members/' + member.id, 'PUT', { status: 'active' }, 404);
  assert.equal((await adminB.request('/members')).results, 0);
  await adminA.request('/members/' + member.id, 'PUT', { status: 'active' }, 403, { origin: 'https://outside.example' });
  await adminA.request('/members/' + member.id, 'PUT', { status: 'active' });
  await adminA.request('/members/' + member.id + '/invite', 'POST', undefined, 503);

  const invite = randomBytes(32).toString('hex');
  await User.update({
    emailVerificationToken: createHash('sha256').update(invite).digest('hex'),
    emailVerificationExpires: new Date(Date.now() + 60000)
  }, { where: { email } });
  await memberClient.request('/auth/accept-invitation', 'POST', { token: invite, password });
  await memberClient.request('/auth/login', 'POST', { email, password });
  await memberClient.request('/members', 'GET', undefined, 403);

  const deposit = { memberId: member.id, type: 'deposit', amount: '1200.05', description: 'Savings contribution' };
  await adminB.request('/transactions', 'POST', deposit, 404);
  await memberClient.request('/transactions', 'POST', deposit, 403);
  const receipt = (await adminA.request('/transactions', 'POST', deposit, 201)).data;
  await adminB.request('/transactions/' + receipt.id, 'GET', undefined, 404);
  assert.equal((await memberClient.request('/transactions/my')).results, 1);
  assert.equal((await memberClient.request('/members/my')).data.savings, '1200.05');
  assert.equal((await adminA.request('/dashboard')).data.totalSavings, '1200.05');
  assert.equal((await adminB.request('/dashboard')).data.totalSavings, '0');

  const loan = (await memberClient.request('/financial/loans', 'POST', {
    amount: '300', term: '3', purpose: 'Purchase equipment'
  }, 201)).data;
  await memberClient.request('/financial/loans/' + loan.id + '/approve', 'PATCH', undefined, 403);
  await adminB.request('/financial/loans/' + loan.id, 'GET', undefined, 404);
  const approved = (await adminA.request('/financial/loans/' + loan.id + '/approve', 'PATCH')).data;
  assert.equal(approved.status, 'approved');
  await adminA.request('/financial/loans/' + loan.id + '/approve', 'PATCH', undefined, 409);

  await adminA.request('/members/' + member.id, 'PUT', { status: 'suspended' });
  await memberClient.request('/auth/me', 'GET', undefined, 401);
  await adminA.request('/auth/logout', 'POST', undefined, 204);
  await adminA.request('/auth/me', 'GET', undefined, 401);
});

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
    if (result.headers.get('content-type') === 'application/pdf') {
      assert.equal(result.status, status);
      assert.match(result.headers.get('content-disposition'), /attachment/);
      const buffer = Buffer.from(await result.arrayBuffer());
      assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
      return buffer;
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

  const staffClient = client(base);
  const staffEmail = 'officer' + suffix + '@example.test';
  const staff = (await adminA.request('/staff', 'POST', {
    email: staffEmail, firstName: 'Loan', lastName: 'Officer', phone: '08012345678',
    permissions: ['members.read', 'finance.read', 'loans.submit']
  }, 201)).data;
  assert.equal(staff.delivered, false);
  assert.equal((await adminB.request('/staff')).data.length, 0);
  await adminB.request('/staff/' + staff.id, 'PUT', { permissions: [], isActive: true }, 404);
  const staffInvite = randomBytes(32).toString('hex');
  await User.update({
    emailVerificationToken: createHash('sha256').update(staffInvite).digest('hex'),
    emailVerificationExpires: new Date(Date.now() + 60000)
  }, { where: { email: staffEmail } });
  await staffClient.request('/auth/accept-invitation', 'POST', { token: staffInvite, password });
  await staffClient.request('/auth/login', 'POST', { email: staffEmail, password });
  assert.equal((await staffClient.request('/members')).results, 1);
  await staffClient.request('/staff', 'GET', undefined, 403);
  await staffClient.request('/reports/activity', 'GET', undefined, 403);
  await staffClient.request('/reports/reconciliation?from=2024-04-01&to=2024-04-01', 'GET', undefined, 403);

  const deposit = { memberId: member.id, type: 'deposit', amount: '1200.05', description: 'Savings contribution', reference: 'DEP-001' };
  await adminB.request('/transactions', 'POST', deposit, 404);
  await memberClient.request('/transactions', 'POST', deposit, 403);
  const receipt = (await adminA.request('/transactions', 'POST', deposit, 201)).data;
  await adminA.request('/transactions', 'POST', deposit, 409);
  await adminB.request('/transactions/' + receipt.id, 'GET', undefined, 404);
  const memberReceipt = await memberClient.request('/documents/receipts/' + receipt.id);
  assert(memberReceipt.length > 1000);
  await adminB.request('/documents/receipts/' + receipt.id, 'GET', undefined, 404);
  const savingsStatement = await memberClient.request('/documents/my-savings-statement');
  assert(savingsStatement.length > 1000);
  await adminA.request('/documents/my-savings-statement', 'GET', undefined, 403);
  assert.equal((await memberClient.request('/transactions/my')).results, 1);
  assert.equal((await memberClient.request('/members/my')).data.savings, '1200.05');
  assert.equal((await adminA.request('/dashboard')).data.totalSavings, '1200.05');
  assert.equal((await adminB.request('/dashboard')).data.totalSavings, '0');

  const withdrawal = (await memberClient.request('/transactions/withdrawals', 'POST', { amount: '100.05' }, 201)).data;
  assert.equal(withdrawal.status, 'pending');
  await memberClient.request('/documents/receipts/' + withdrawal.id, 'GET', undefined, 404);
  await memberClient.request('/transactions/withdrawals', 'POST', { amount: '1100.01' }, 409);
  assert.equal((await memberClient.request('/members/my')).data.savings, '1200.05');
  await adminB.request('/transactions/withdrawals/' + withdrawal.id + '/approve', 'PATCH', undefined, 404);
  await adminA.request('/transactions/withdrawals/' + withdrawal.id + '/approve', 'PATCH', { reference: 'WD-001' });
  await adminA.request('/transactions/withdrawals/' + withdrawal.id + '/approve', 'PATCH', undefined, 409);
  assert.equal((await memberClient.request('/members/my')).data.savings, '1100.00');

  await adminA.request('/settings', 'PUT', {
    cooperativeName: 'Alpha', email: '', phone: '', address: '', loanRate: '12'
  });
  assert.equal((await memberClient.request('/financial/loans/policy')).data.loanRate, '12');
  const loan = (await memberClient.request('/financial/loans', 'POST', {
    amount: '300', term: '3', purpose: 'Purchase equipment', agreedRate: '12'
  }, 201)).data;
  await memberClient.request('/financial/loans/' + loan.id + '/approve', 'PATCH', undefined, 403);
  await adminB.request('/financial/loans/' + loan.id, 'GET', undefined, 404);
  const approved = (await adminA.request('/financial/loans/' + loan.id + '/approve', 'PATCH')).data;
  assert.equal(approved.status, 'approved');
  await adminA.request('/financial/loans/' + loan.id + '/approve', 'PATCH', undefined, 409);

  await adminA.request('/staff/' + staff.id, 'PUT', {
    isActive: true, permissions: ['members.read', 'finance.read', 'loans.submit', 'loans.decide']
  });
  const staffLoan = (await staffClient.request('/financial/loans', 'POST', {
    memberId: member.id, amount: '200', term: 3, purpose: 'Tools', agreedRate: '12'
  }, 201)).data;
  await staffClient.request('/financial/loans/' + staffLoan.id + '/approve', 'PATCH', undefined, 409);
  await adminA.request('/financial/loans/' + staffLoan.id + '/reject', 'PATCH');
  await adminA.request('/staff/' + staff.id, 'PUT', { isActive: false, permissions: [] });
  await staffClient.request('/auth/me', 'GET', undefined, 401);

  const active = (await adminA.request('/financial/loans/' + loan.id + '/disburse', 'POST', { reference: 'DF-001' })).data;
  assert.equal(active.status, 'active');
  assert.equal(active.remainingBalance, '309.00');
  await adminA.request('/financial/loans/' + loan.id + '/disburse', 'POST', { reference: 'DF-001' }, 409);
  const partial = (await adminA.request('/financial/loans/' + loan.id + '/repayments', 'POST', {
    amount: '105', reference: 'RP-001'
  }, 201)).data.loan;
  assert.equal(partial.remainingBalance, '204.00');
  await adminA.request('/financial/loans/' + loan.id + '/repayments', 'POST', {
    amount: '105', reference: 'RP-001'
  }, 409);
  await adminA.request('/financial/loans/' + loan.id + '/repayments', 'POST', {
    amount: '205', reference: 'RP-002'
  }, 400);
  const settled = (await adminA.request('/financial/loans/' + loan.id + '/repayments', 'POST', {
    amount: '204', reference: 'RP-002'
  }, 201)).data.loan;
  assert.equal(settled.status, 'completed');
  assert.equal(settled.remainingBalance, '0.00');
  const detail = await memberClient.request('/financial/loans/' + loan.id);
  assert.equal(detail.schedule.length, 3);
  assert(detail.schedule.every(row => row.principal === row.principalPaid && row.interest === row.interestPaid));
  const [postings] = await sequelize.query(`
    SELECT "debitAccount", "creditAccount", "amount" FROM "FinancialPostings"
    WHERE "cooperativeId" = :cooperativeId
  `, { replacements: { cooperativeId: userA.cooperativeId } });
  assert.equal(postings.length, 7);
  assert.equal(postings.filter(row => row.creditAccount === 'interest_income').reduce((sum, row) => sum + Number(row.amount), 0), 9);
  await assert.rejects(sequelize.query(`DELETE FROM "FinancialPostings" WHERE "cooperativeId" = :cooperativeId`,
    { replacements: { cooperativeId: userA.cooperativeId } }), /immutable/);

  const audit = (await adminA.request('/audit')).data;
  assert(audit.some(entry => entry.action === 'loan.disbursed'));
  assert(audit.some(entry => entry.action === 'staff.permissions_updated'));
  assert.equal((await adminB.request('/audit')).data.length, 0);
  await memberClient.request('/audit', 'GET', undefined, 403);

  const report = (await adminA.request('/reports/activity?months=3')).data;
  assert.equal(report.length, 3);
  assert.equal(report[2].deposits, '1200.05');
  assert.equal(report[2].withdrawals, '100.05');
  assert.equal(report[2].disbursements, '300.00');
  assert.equal(report[2].repayments, '309.00');
  const otherReport = (await adminB.request('/reports/activity?months=3')).data;
  assert.equal(otherReport[2].deposits, '0');
  await memberClient.request('/reports/activity', 'GET', undefined, 403);

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  const reconciliation = '/reports/reconciliation?from=' + today + '&to=' + today;
  const clean = (await adminA.request(reconciliation)).data;
  assert.deepEqual({
    opening: clean.openingSavings, deposits: clean.deposits, withdrawals: clean.withdrawals,
    closing: clean.closingSavings, disbursed: clean.disbursements, repaid: clean.repayments,
    currentSavings: clean.currentSavings, currentLoans: clean.currentLoans,
    transactionCount: clean.transactionCount, issueCount: clean.issueCount
  }, {
    opening: '0.00', deposits: '1200.05', withdrawals: '100.05', closing: '1100.00', disbursed: '300.00',
    repaid: '309.00', currentSavings: '1100.00', currentLoans: '0.00', transactionCount: 5, issueCount: 0
  });
  assert.deepEqual(clean.issues, []);
  const isolated = (await adminB.request(reconciliation)).data;
  assert.equal(isolated.closingSavings, '0.00');
  assert.equal(isolated.issueCount, 0);
  await adminA.request('/reports/reconciliation?from=2024-02-30&to=2024-03-01', 'GET', undefined, 400);
  await adminA.request(reconciliation + '&page=0', 'GET', undefined, 400);
  await memberClient.request(reconciliation, 'GET', undefined, 403);

  // Put three completed legacy records around the selected local day. A withdrawal
  // created earlier belongs to the day when it was completed.
  const [beforeId, duringId, afterId] = Array.from({ length: 3 }, () => randomUUID());
  await sequelize.query(`
    INSERT INTO "Transactions" (id, "cooperativeId", "memberId", type, amount, status, description,
      "externalReference", "createdAt", "updatedAt")
      VALUES
        (:beforeId, :cooperativeId, :memberId, 'deposit', 200, 'completed', 'Legacy opening deposit',
          'LEGACY-DEP', '2024-03-31T22:59:59Z', '2024-03-31T22:59:59Z'),
        (:duringId, :cooperativeId, :memberId, 'withdrawal', 15.25, 'completed', 'Legacy payout',
          'LEGACY-WD', '2024-03-31T22:00:00Z', '2024-03-31T23:00:00Z'),
        (:afterId, :cooperativeId, :memberId, 'deposit', 100, 'completed', 'Next day deposit',
          'LEGACY-NEXT', '2024-04-01T23:00:00Z', '2024-04-01T23:00:00Z')
  `, { replacements: { beforeId, duringId, afterId, cooperativeId: userA.cooperativeId, memberId: member.id } });

  const historicalUrl = '/reports/reconciliation?from=2024-04-01&to=2024-04-01';
  const historical = (await adminA.request(historicalUrl)).data;
  assert.equal(historical.openingSavings, '200.00');
  assert.equal(historical.deposits, '0.00');
  assert.equal(historical.withdrawals, '15.25');
  assert.equal(historical.closingSavings, '184.75');
  assert.equal(historical.currentSavings, '1100.00');
  assert.equal(historical.transactionCount, 1);
  assert.deepEqual(historical.issues.map(issue => [issue.reason, issue.recordId, issue.expected, issue.recorded]), [
    ['missing_postings', duringId, '15.25', '0.00'],
    ['savings_balance', member.id, '1384.75', '1100.00']
  ]);
  assert.equal(historical.issues[0].reference, 'LEGACY-WD');

  await sequelize.query('UPDATE "Loans" SET "remainingBalance" = 1 WHERE id = :loanId',
    { replacements: { loanId: loan.id } });
  const drift = (await adminA.request(historicalUrl)).data;
  assert(drift.issues.some(issue => issue.reason === 'loan_balance' && issue.recordId === loan.id &&
    issue.expected === '0.00' && issue.recorded === '1.00'));
  assert.equal((await adminB.request(historicalUrl)).data.issueCount, 0);

  await adminA.request('/members/' + member.id, 'PUT', { status: 'suspended' });
  await memberClient.request('/auth/me', 'GET', undefined, 401);
  await adminA.request('/auth/logout', 'POST', undefined, 204);
  await adminA.request('/auth/me', 'GET', undefined, 401);
});

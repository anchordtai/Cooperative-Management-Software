const assert = require('node:assert/strict');
const { test } = require('node:test');

test('production signup without SMTP credentials leaves the database untouched', async t => {
  const original = process.env;
  process.env = {
    ...original, NODE_ENV: 'production', SMTP_HOST: 'smtp.example.test',
    SMTP_USER: 'sender', SMTP_FROM: 'sender@example.test', SMTP_PASS: ''
  };
  t.after(() => { process.env = original; });

  const sequelize = require('../dist/config/database').default;
  const { register } = require('../dist/controllers/auth.controller');
  const transaction = t.mock.method(sequelize, 'transaction', () => {
    throw new Error('Registration should not start a database transaction');
  });
  const errors = [];
  const req = { body: {
    email: 'register@example.test', password: 'ValidPassword123!',
    firstName: 'Test', lastName: 'Account', phone: '08012345678', cooperativeName: 'Test Cooperative'
  } };
  await register(req, {}, error => errors.push(error));

  assert.equal(transaction.mock.callCount(), 0);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].statusCode, 503);
  assert.match(errors[0].message, /verification email is offline/);
});

test('resend during a configuration outage returns a generic error without looking up an account', async t => {
  const originalEnv = process.env;
  process.env = { ...originalEnv, SMTP_PASS: '', SMTP_PORT: '465' };
  t.after(() => { process.env = originalEnv; });
  const { User } = require('../dist/models/User');
  const { resendEmail } = require('../dist/controllers/auth.controller');
  const userLookup = t.mock.method(User, 'findOne', () => {
    throw new Error('Email outage should be handled before looking up an account');
  });
  const errors = [];
  await resendEmail({ body: { email: 'pending@example.test' } }, {}, error => errors.push(error));
  assert.equal(userLookup.mock.callCount(), 0);
  assert.equal(errors[0].statusCode, 503);
  assert.match(errors[0].message, /temporarily unavailable/);
});

test('mail transport logs only approved diagnostics when the provider rejects delivery', async t => {
  const originalEnv = process.env;
  process.env = { ...originalEnv, SMTP_HOST: 'smtp.example.test', SMTP_PORT: '465',
    SMTP_USER: 'test-user', SMTP_PASS: 'test-secret', SMTP_FROM: 'sender@example.test' };
  t.after(() => { process.env = originalEnv; });
  const nodemailer = require('nodemailer');
  const rejection = Object.assign(new Error('Details include a private recipient address'), {
    code: 'EAUTH', responseCode: 535, response: 'Provider response with private diagnostic data'
  });
  t.mock.method(nodemailer, 'createTransport', options => {
    assert.equal(options.secure, true);
    return { sendMail: async () => { throw rejection; } };
  });
  const errorLog = t.mock.method(console, 'error', () => {});
  const { sendEmail } = require('../dist/utils/email');
  await assert.rejects(sendEmail('private@example.test', 'Account verification', 'a private link'), error => error === rejection);
  assert.deepEqual(errorLog.mock.calls.map(call => call.arguments), [
    ['Email delivery failed', { code: 'EAUTH', responseCode: 535 }]
  ]);
});

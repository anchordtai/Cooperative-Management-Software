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

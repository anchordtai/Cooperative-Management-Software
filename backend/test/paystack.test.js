const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { test } = require('node:test');
const { validPaystackSignature, initializePaystack, verifyPaystack } = require('../dist/services/paystack');

test('Paystack webhook signatures verify against the unchanged request body', () => {
  const raw = Buffer.from('{"event":"charge.success","data":{"amount":100.00}}');
  const secret = 'sk_test_fixture';
  const signingSecret = 'whsec_fixture';
  const timestamp = 1789873011;
  const digest = (key, data) => createHmac('sha512', key).update(data).digest('hex');
  const legacy = digest(secret, raw);
  const signature = digest(signingSecret, Buffer.concat([Buffer.from(timestamp + '.'), raw]));
  const signed = `t=${timestamp},v1=whk_wrong:${'0'.repeat(128)},v1=whk_test:${signature}`;
  assert.equal(validPaystackSignature(raw, legacy, undefined, secret, [], timestamp), true);
  assert.equal(validPaystackSignature(raw, undefined, signed, secret, [signingSecret], timestamp + 300), true);
  assert.equal(validPaystackSignature(raw, legacy, signed, secret, [signingSecret], timestamp + 301), false);
  assert.equal(validPaystackSignature(Buffer.from(JSON.stringify(JSON.parse(raw))), legacy, signed, secret, [signingSecret], timestamp), false);
});

test('Paystack requests use a fixed API origin and validate the hosted checkout URL and reference', async t => {
  t.mock.method(globalThis, 'fetch', async (url, request) => {
    assert.equal(request.headers.Authorization, 'Bearer sk_test_fixture');
    if (url.endsWith('/initialize')) {
      assert.deepEqual(JSON.parse(request.body), {
        email: 'test@example.test', reference: 'ref123', amount: '10000',
        currency: 'NGN', callback_url: 'http://localhost:3000/user-dashboard'
      });
      return Response.json({ status: true, data: { reference: 'ref123', authorization_url: 'https://checkout.paystack.com/example' } });
    }
    assert.equal(url, 'https://api.paystack.co/transaction/verify/ref123');
    return Response.json({
      status: true, data: { reference: 'ref123', amount: 10000, status: 'success', domain: 'test', currency: 'NGN' }
    });
  });
  const url = await initializePaystack('sk_test_fixture', 'ref123', 'test@example.test', 10000, 'http://localhost:3000/user-dashboard');
  assert.equal(url, 'https://checkout.paystack.com/example');
  assert.equal((await verifyPaystack('sk_test_fixture', 'ref123')).amount, 10000);
  globalThis.fetch.mock.mockImplementation(async () => Response.json({
    status: true, data: { reference: 'ref123', authorization_url: 'https://checkout.paystack.com.example.test/' }
  }));
  await assert.rejects(initializePaystack('sk_test_fixture', 'ref123', 'test@example.test', 10000, 'http://localhost:3000/user-dashboard'), /Invalid Paystack checkout/);
});

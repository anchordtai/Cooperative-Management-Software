const originalFetch = globalThis.fetch;

globalThis.fetch = async (input, options) => {
  const url = new URL(input);
  if (url.hostname !== 'api.paystack.co') return originalFetch(input, options);
  if (options.headers.Authorization !== 'Bearer sk_test_local_provider_fixture') return Response.json({ status: false }, { status: 401 });

  if (url.pathname === '/transaction/initialize') {
    const transaction = JSON.parse(options.body);
    return Response.json({ status: true, data: {
      reference: transaction.reference,
      authorization_url: 'https://checkout.paystack.com/local-provider-fixture'
    } });
  }
  return Response.json({
    status: true,
    data: {
      status: 'success', reference: url.pathname.split('/').pop(),
      domain: 'test', currency: 'NGN', amount: 20050
    }
  });
};

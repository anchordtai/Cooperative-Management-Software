const assert = require('node:assert/strict');
const { test } = require('node:test');
const { previewDatabaseUrl } = require('../dist/config/preview-database');

test('Vercel Preview requires an explicit staging endpoint and verifies TLS', () => {
  const inherited = {
    DATABASE_URL: 'postgresql://user:fixture@ep-main-pooler.example.test/neondb',
    DATABASE_URL_UNPOOLED: 'postgresql://user:fixture@ep-main.example.test/neondb'
  };
  assert.equal(previewDatabaseUrl(inherited), undefined);
  assert.throws(() => previewDatabaseUrl({
    ...inherited, SAAS_STAGING_DATABASE_URL: 'postgresql://other:fixture@ep-main.example.test/other'
  }), /separate PostgreSQL endpoint/);
  assert.throws(() => previewDatabaseUrl({
    ...inherited, SAAS_STAGING_DATABASE_URL: 'postgresql://other:fixture@ep-main-pooler.example.test/other'
  }), /separate PostgreSQL endpoint/);
  assert.throws(() => previewDatabaseUrl({ SAAS_STAGING_DATABASE_URL: 'https://ep-stage.example.test/neondb' }), /PostgreSQL connection URL/);
  const separate = new URL(previewDatabaseUrl({
    ...inherited, SAAS_STAGING_DATABASE_URL: 'postgresql://user:fixture@ep-stage.example.test/neondb?sslmode=require&channel_binding=require'
  }));
  assert.equal(separate.hostname, 'ep-stage.example.test');
  assert.equal(separate.searchParams.get('sslmode'), 'verify-full');
  assert.equal(separate.searchParams.get('channel_binding'), 'require');
});

# Co-opSphere SaaS rollout

- [x] Audit the existing authentication, cooperative settings, owner console, tenant APIs, Paystack sandbox deposits, SMTP and migration runner.
- [x] Add the subscription catalog, cooperative onboarding and billing, owner billing controls, and CSV and Excel member import.
- [x] Add subscription and membership capacity checks at the API, with an opt-in enforcement flag.
- [x] Test checkout and payment verification with simulated provider responses, alongside a real PostgreSQL integration database.
- [ ] Verify the approved merchant accounts and webhook deliveries against an isolated staging deployment.
- [ ] Approve the prices, access policy for existing tenants and migration plan.
- [ ] Confirm billing emails arrive from the production SMTP sender and schedule the billing job.
- [ ] Complete reversal and dispute workflows, negotiated billing and formal invoice requirements before making those features available.

## Isolated staging

1. Create a dedicated Neon project or schema-only branch with its own PostgreSQL endpoint. In Vercel, save its direct URL as a sensitive `SAAS_STAGING_DATABASE_URL` scoped to Preview and the SaaS Git branch. The application ignores the inherited `DATABASE_URL` in Preview and rejects a staging endpoint matching the inherited database, including a pooled alias. The preview API returns 503 until an isolated connection is configured.
2. Add a random staging-only `JWT_SECRET`, staging SMTP values using a dedicated sending key, and the authorised `PLATFORM_OWNER_EMAIL` for the same branch. Set `PLATFORM_OWNER_BOOTSTRAP=1` to provision that owner on staging, and set `FRONTEND_URL` to the stable staging branch URL. Redeploy the branch. The build automatically runs migrations against the isolated database. Confirm a 200 response from `/health` and five plans from `/api/billing/plans`. Use the staging sign-in page's platform-owner reset flow to activate the account.
3. Set `SAAS_PAYMENT_MODE=test` and set the two gateways' sandbox credentials as sensitive settings. Set `SAAS_FLUTTERWAVE_ACCOUNT_ID` to the numeric merchant ID and `SAAS_FLUTTERWAVE_WEBHOOK_HASH` to the configured v3 verification hash. Paystack authenticates subscription events with the same billing secret used for verification. Subscribe to events at `/api/billing/webhooks/paystack` and `/api/billing/webhooks/flutterwave`. The callback returns to `/billing`. Ensure staging deployment protection allows the provider to reach the webhook routes under the deployment's approved access settings.
4. As the platform owner, publish sandbox pricing for the cycles under test at `/platform/billing`. Use `SAAS_ENFORCE_SUBSCRIPTIONS=true` in staging to check the full access gate. With a fresh cooperative admin, test profile completion, a verified checkout for each provider, pending or failed verification, payment replay, and an authenticated PDF receipt. Exercise real sandbox events in addition to the integration tests.
5. Set a random `CRON_SECRET` of at least 32 characters and invoke `GET /api/jobs/billing` with an `Authorization: Bearer <CRON_SECRET>` header from a trusted scheduler. Schedule it daily at 06:00 UTC (07:00 WAT) or more often when queue volume requires it. Verify receipt and reminder delivery. The endpoint queues reminders and drains up to 15 due messages per call with bounded retries. This branch ships the protected endpoint and requires scheduler configuration.

## Production rollout

Take a database backup, apply the migration through the existing runner against the production direct connection, and verify the current registration, owner and tenant workflows. Leave subscription enforcement off while the owner configures approved prices, grace periods and any explicitly authorised trials for existing tenants. For live billing set `SAAS_PAYMENT_MODE=live`, the approved sensitive live merchant credentials, the exact production `FRONTEND_URL`, the production webhook destinations, and the billing scheduler. Keep the subscription and member-savings gateway configuration separate. Turn enforcement on once tenant transition and a controlled live payment have been authorised and verified.

A verified on-time renewal appends the chosen cycle. An immediate higher-capacity upgrade starts a new term at the full new price. A lower-capacity plan can be purchased after the active paid term ends if the cooperative fits the new cap. Cancellation preserves paid access to the term end and disables grace. No recurring mandate is created. If multiple completed checkouts conflict with a changed term or capacity, the later payment appears under the owner's `review` filter for manual reconciliation. Refund and chargeback processing require reconciliation with each provider.

Paid receipts are available to the paying cooperative's admins. Separate prepayment or formal tax invoices require approved invoicing rules and seller details. Enterprise Plus supports configurable or unlimited capacity and a custom-pricing enquiry. Negotiated contract checkout is currently handled outside self-service. CSV and XLSX imports run in chunks of up to 100 rows per upload, support partial imports when explicitly selected and skip duplicates. Imports do not update existing members.

If access needs restoring during rollout, redeploy with `SAAS_ENFORCE_SUBSCRIPTIONS=false`. Keep billing records and webhook verification in place to reconcile payments already taken. Do not roll back by deleting financial or subscription history.

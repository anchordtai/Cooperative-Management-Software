# Co-opSphere

Co-opSphere is a proprietary cooperative management software solution owned and developed by Mega Stride Technologies Limited. It is a React, TypeScript, Material UI and Vite application backed by Express, Sequelize and PostgreSQL.

Cooperative Management, Simplified.

See the [branding review](docs/branding-review.md) for public pages, assets and release checks.

## Development status

The foundation supports cooperative administrator registration, email verification, sign-in, rotating sessions, cooperative settings, staff invitations and role permissions, member approval and activation invitations, savings deposits and approved withdrawals, loan applications, approval, disbursement recording, repayment schedules, partial and full repayment, and dashboards based on PostgreSQL records. Member accounts can view their own profile and financial history. The administrative API enforces cooperative scope on each request. Audit history records staff permission changes, loan decisions and financial postings.

The project is in development. Configurable financial products, general-ledger management and financial statements, live payment settlement, additional gateways, subscriptions, governance and production acceptance remain open.

## Run locally

Use Node.js 22.12 or later and PostgreSQL. Create an empty PostgreSQL database and configure a database user with access.

1. Copy `backend/.env.example` to `backend/.env` and set the PostgreSQL connection, a unique `JWT_SECRET` of at least 32 bytes, and the frontend URL. Use `openssl rand -hex 32` to generate a secret.
2. Configure authenticated SMTP for verification, invitations and password recovery. Set `SUPPORT_EMAIL` to accept website enquiries. Port 465 uses implicit TLS. Other ports require STARTTLS.
3. In `backend`, run `npm ci`, `npm run build`, `npm run db:migrate`, then `npm start`.
4. In `frontend`, run `npm ci` and `npm start`. The development app defaults to `http://localhost:5000/api`. Set `REACT_APP_API_URL` to use a different backend.

Register a cooperative at `/register` and follow the verification link in the email. In the administration area, add a member, set the membership status to **Active**, and choose **Invite to sign in**. Members create a password from the invitation link.

## Financial workflows

- An administrator sets the annual flat loan rate under **Settings**. Each application records the rate accepted at submission. Leaving the rate blank pauses new applications.
- After approval and independent confirmation of an external transfer, an administrator records its reference to disburse the loan in the system. The application does not initiate transfers.
- The backend generates monthly instalments, rounds total interest once to the nearest kobo, and allocates repayments to the oldest instalment first, with interest before principal. A recorded repayment reference cannot be used twice on the same loan.
- Members submit withdrawal requests. Pending requests reserve the amount. An authorised officer rejects the request or records its confirmed payout reference. The backend rechecks the available savings when recording the payout.
- Deposits, approved withdrawals, disbursements and repayments produce paired debit and credit postings in the same database transaction. The activity report aggregates completed transactions across the full period and supports CSV export. Members can download PDF receipts and a savings activity statement for the previous 12 months.

## Reconciliation

Open **Reports → Reconciliation** with the `reports.read` permission. Select dates in West Africa Time to review opening and closing savings from available transaction history, deposits, payouts, loan disbursements and repayments. Download the summary or export the page of exceptions being reviewed. Each exception identifies the underlying record and includes the transfer reference where available.

The period review checks transaction amounts and account directions against immutable postings. The report also checks current member savings and loan balances against recorded savings movements, loan schedules and the ledger. Current balances are shown separately from historical period values. Imported balances without matching transactions may require investigation. This report is read-only. Independent bank statements or payment-provider settlement reports are still needed to confirm external funds movement.

## Paystack test checkout

Use a disposable database and an explicitly selected test cooperative. Set `PAYSTACK_SECRET_KEY` to a Paystack test key and set `PAYSTACK_TEST_COOPERATIVE_ID` to the test cooperative ID. The test deposit form then appears for its signed-in members. Configure the Paystack test dashboard to send webhooks to `/api/webhooks/paystack` on a publicly reachable staging API. Set `PAYSTACK_WEBHOOK_SECRET` if the dashboard uses a webhook signing secret.

A checkout or browser return leaves the deposit pending until the backend independently verifies the provider result. The backend checks the original reference, amount, currency and test mode before posting a deposit. Webhook retries and repeated manual verification share the same idempotent posting path. Sandbox deposits are test records. Production settlement requires a separate merchant-routing design and live reconciliation verification.

## Database upgrades

Back up the database and run `npm run db:migrate` from `backend` after building. The runner serializes concurrent migration attempts and records completed migrations. It preserves existing data.

Pre-existing records have no reliable cooperative assignment. They are preserved with a null cooperative ID and excluded from application access. Before migrating a production installation, prepare and validate an explicit mapping of each legacy account and member to its cooperative. Map linked users, members, transactions and loans together, reconcile opening balances and verify previous administrative roles before enabling those accounts. The application does not guess ownership or financial opening balances.

## Build and verification

- Frontend and backend each use `npm run build`. Run `npm test` in `frontend` for frontend tests.
- For backend integration tests, provision a disposable PostgreSQL database, configure its connection, run the migrations and then run `ECOOPERATIVE_TEST_DATABASE=1 npm test` from `backend`. The tests create sample organisations and members in that database. They use port 55433 by default. Override with `TEST_PORT`.
- `GET /health` checks backend connectivity to PostgreSQL.

## Deployment configuration

Build the frontend with the real `REACT_APP_API_URL` or configure a same-origin `/api` proxy ahead of the SPA fallback. Serve the SPA over HTTPS. Configure `REACT_APP_TERMS_URL` and `REACT_APP_PRIVACY_URL` with your approved policy URLs to display them at signup. Set the backend `FRONTEND_URL` to the corresponding origin, configure PostgreSQL TLS where required, and set all secrets in the deployment environment. Deploy frontend and API on the same site where possible so browsers can send HTTP-only session cookies. For different sites, `COOKIE_CROSS_SITE=true` enables `SameSite=None` with production HTTPS. Browser third-party cookie restrictions can still affect that setup.

Run migrations as a release step. Older provider guides in the repository describe previous configurations. Use the commands and configuration in this README before deploying the current branch.

### Vercel

Use the repository root as the project root. The root `vercel.json` builds the Vite frontend and routes the same-origin `/api` to the Express function. Set `FRONTEND_URL` to the canonical HTTPS site origin. Account, invitation and recovery emails link to this origin. Set `FRONTEND_ALLOWED_ORIGINS` to a comma-separated list of additional trusted origins during a domain transition. Configure PostgreSQL with `DATABASE_URL` and `DB_SSL=true`, set an independent `JWT_SECRET` for each environment, and configure authenticated SMTP before opening registration. Run migrations against the intended database as a separate release step. When the database is provisioned through Vercel, you can set `ECOOPERATIVE_MIGRATE_ON_DEPLOY=1` for a trusted production build, then reset it to `0` after the build succeeds. The build uses `DATABASE_URL_UNPOOLED` for migrations when available. Preview builds skip this step. Keep preview environments on an isolated database.

`/api/health` returns HTTP 503 until the database is configured and reachable.

### Custom domain transition

1. Add and verify the chosen hostname in the existing Vercel project.
2. Set `FRONTEND_URL` to the new HTTPS origin and keep the current hostname in `FRONTEND_ALLOWED_ORIGINS`. Keep both hostnames pointed at the app while previously issued links are still valid.
3. Update the site's public sharing metadata, redeploy, then verify signup, sign-in, email verification, staff and member invitations, and password recovery from the new hostname. Sessions use host-specific cookies, so users moving to a new hostname need to sign in there.
4. A domain transition for the website can use the existing verified sending domain. Check provider activity and the Vercel function's `Email delivery failed` entry if an email fails. The application logs only a transport error category and a numeric SMTP response code.

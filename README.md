# E-Cooperative

E-Cooperative is a React, TypeScript and Material UI application backed by Express, Sequelize and PostgreSQL.

## Development status

The foundation supports cooperative administrator registration, email verification, sign-in, rotating sessions, cooperative settings, staff invitations and role permissions, member approval and activation invitations, savings deposits and approved withdrawals, loan applications, approval, disbursement recording, repayment schedules, partial and full repayment, and dashboards based on PostgreSQL records. Member accounts can view their own profile and financial history. The administrative API enforces cooperative scope on each request. Audit history records staff permission changes, loan decisions and financial postings.

The project is in development. Configurable financial products, general-ledger management and financial statements, payment gateways, subscriptions, governance and production acceptance remain open.

## Run locally

Use Node.js 22 or later and PostgreSQL. Create an empty PostgreSQL database and configure a database user with access.

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
- Deposits, approved withdrawals, disbursements and repayments produce paired debit and credit postings in the same database transaction. The activity report aggregates completed transactions across the full period and supports CSV export.

## Database upgrades

Back up the database and run `npm run db:migrate` from `backend` after building. The runner serializes concurrent migration attempts and records completed migrations. It preserves existing data.

Pre-existing records have no reliable cooperative assignment. They are preserved with a null cooperative ID and excluded from application access. Before migrating a production installation, prepare and validate an explicit mapping of each legacy account and member to its cooperative. Map linked users, members, transactions and loans together, reconcile opening balances and verify previous administrative roles before enabling those accounts. The application does not guess ownership or financial opening balances.

## Build and verification

- Frontend and backend each use `npm run build`.
- For backend integration tests, provision a disposable PostgreSQL database, configure its connection, run the migrations and then run `ECOOPERATIVE_TEST_DATABASE=1 npm test` from `backend`. The tests create sample organisations and members in that database. They use port 55433 by default. Override with `TEST_PORT`.
- `GET /health` checks backend connectivity to PostgreSQL.

## Deployment configuration

Build the frontend with the real `REACT_APP_API_URL` or configure a same-origin `/api` proxy ahead of the SPA fallback. Serve the SPA over HTTPS. Configure `REACT_APP_TERMS_URL` and `REACT_APP_PRIVACY_URL` with your approved policy URLs to display them at signup. Set the backend `FRONTEND_URL` to the corresponding origin, configure PostgreSQL TLS where required, and set all secrets in the deployment environment. Deploy frontend and API on the same site where possible so browsers can send HTTP-only session cookies. For different sites, `COOKIE_CROSS_SITE=true` enables `SameSite=None` with production HTTPS. Browser third-party cookie restrictions can still affect that setup.

Run migrations as a release step. Older provider guides in the repository describe previous configurations. Use the commands and configuration in this README before deploying the current branch.

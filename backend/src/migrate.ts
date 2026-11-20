import sequelize from './config/database';
import './models';
import './models/Session';
import { saasSchema } from './saas-schema';

async function migrate() {
  await sequelize.transaction(async transaction => {
    const run = (sql: string) => sequelize.query(sql, { transaction });

    await run('SELECT pg_advisory_xact_lock(2114826001)');
    await run('CREATE TABLE IF NOT EXISTS "SchemaMigrations" (version text PRIMARY KEY)');
    const [applied] = await run(`SELECT version FROM "SchemaMigrations" WHERE version = '001_cooperative_foundation'`);
    if (applied.length === 0) {
      const syncOptions = { transaction, logging: false as const };
      await sequelize.sync(syncOptions);
      for (const table of ['Users', 'Members', 'Transactions', 'Loans']) {
        await run(`
          ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "cooperativeId" uuid REFERENCES "Cooperatives"(id);
          CREATE UNIQUE INDEX IF NOT EXISTS "${table}_cooperative_record" ON "${table}" ("cooperativeId", id);
        `);
      }
      await run(`
        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "emailVerificationExpires" timestamptz;
        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "passwordResetToken" varchar(255);
        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "passwordResetExpires" timestamptz;
        ALTER TABLE "Loans" ADD COLUMN IF NOT EXISTS "startDate" timestamptz;
        ALTER TABLE "Loans" ADD COLUMN IF NOT EXISTS "endDate" timestamptz;
        ALTER TABLE "Loans" ADD COLUMN IF NOT EXISTS "remainingBalance" numeric(10,2);
        ALTER TABLE "Loans" ALTER COLUMN "startDate" DROP NOT NULL;
        ALTER TABLE "Loans" ALTER COLUMN "endDate" DROP NOT NULL;
        ALTER TABLE "Members" ADD COLUMN IF NOT EXISTS email varchar(255);
        ALTER TABLE "Members" ADD COLUMN IF NOT EXISTS savings numeric(10,2) DEFAULT 0;
        ALTER TABLE "Members" ADD COLUMN IF NOT EXISTS "shareCapital" numeric(10,2) DEFAULT 0;
        ALTER TABLE "Members" ALTER COLUMN "userId" DROP NOT NULL;
        ALTER TABLE "Members" ALTER COLUMN "dateOfBirth" DROP NOT NULL;
        ALTER TABLE "Members" ADD CONSTRAINT members_cooperative_user
          FOREIGN KEY ("cooperativeId", "userId") REFERENCES "Users" ("cooperativeId", id);
        CREATE UNIQUE INDEX members_cooperative_user_unique ON "Members" ("cooperativeId", "userId");
        ALTER TABLE "Transactions" ADD CONSTRAINT transactions_cooperative_member
          FOREIGN KEY ("cooperativeId", "memberId") REFERENCES "Members" ("cooperativeId", id);
        ALTER TABLE "Loans" ADD CONSTRAINT loans_cooperative_member
          FOREIGN KEY ("cooperativeId", "memberId") REFERENCES "Members" ("cooperativeId", id);
        INSERT INTO "SchemaMigrations" (version) VALUES ('001_cooperative_foundation');
      `);
    }

    const [financial] = await run(`SELECT version FROM "SchemaMigrations" WHERE version = '002_financial_postings'`);
    if (financial.length === 0) {
      await run(`
        ALTER TABLE "Transactions" ADD COLUMN IF NOT EXISTS "requestedBy" uuid;
        ALTER TABLE "Transactions" ADD COLUMN IF NOT EXISTS "handledBy" uuid;
        ALTER TABLE "Transactions" ADD COLUMN IF NOT EXISTS "loanId" uuid;
        ALTER TABLE "Transactions" ADD COLUMN IF NOT EXISTS "externalReference" varchar(160);
        CREATE UNIQUE INDEX transactions_unique_external_reference
          ON "Transactions" ("cooperativeId", type, "externalReference") WHERE "externalReference" IS NOT NULL;
        ALTER TABLE "Transactions" ADD FOREIGN KEY ("cooperativeId", "requestedBy")
          REFERENCES "Users" ("cooperativeId", id);
        ALTER TABLE "Transactions" ADD FOREIGN KEY ("cooperativeId", "handledBy")
          REFERENCES "Users" ("cooperativeId", id);
        CREATE UNIQUE INDEX loans_cooperative_member_record ON "Loans" ("cooperativeId", "memberId", id);
        ALTER TABLE "Transactions" ADD FOREIGN KEY ("cooperativeId", "memberId", "loanId")
          REFERENCES "Loans" ("cooperativeId", "memberId", id);
        ALTER TYPE "enum_Transactions_type" ADD VALUE IF NOT EXISTS 'loan';
        ALTER TYPE "enum_Transactions_type" ADD VALUE IF NOT EXISTS 'repayment';

        CREATE TABLE "FinancialPostings" (
          "cooperativeId" uuid NOT NULL,
          "transactionId" uuid NOT NULL,
          "sequence" smallint NOT NULL CHECK ("sequence" > 0),
          "debitAccount" text NOT NULL,
          "creditAccount" text NOT NULL,
          "amount" numeric(10,2) NOT NULL CHECK ("amount" > 0),
          "createdAt" timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY ("cooperativeId", "transactionId", "sequence"),
          FOREIGN KEY ("cooperativeId", "transactionId") REFERENCES "Transactions" ("cooperativeId", id),
          CHECK ("debitAccount" <> "creditAccount")
        );

        CREATE FUNCTION reject_financial_posting_change() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          RAISE EXCEPTION 'Posted accounting entries are immutable';
        END
        $$;
        CREATE TRIGGER immutable_financial_postings
          BEFORE UPDATE OR DELETE ON "FinancialPostings"
          FOR EACH ROW EXECUTE FUNCTION reject_financial_posting_change();

        CREATE TABLE "LoanInstallments" (
          "cooperativeId" uuid NOT NULL,
          "loanId" uuid NOT NULL,
          "number" smallint NOT NULL CHECK ("number" > 0),
          "dueOn" date NOT NULL,
          "principal" numeric(10,2) NOT NULL CHECK ("principal" >= 0),
          "interest" numeric(10,2) NOT NULL CHECK ("interest" >= 0),
          "principalPaid" numeric(10,2) NOT NULL DEFAULT 0 CHECK ("principalPaid" BETWEEN 0 AND "principal"),
          "interestPaid" numeric(10,2) NOT NULL DEFAULT 0 CHECK ("interestPaid" BETWEEN 0 AND "interest"),
          PRIMARY KEY ("cooperativeId", "loanId", "number"),
          FOREIGN KEY ("cooperativeId", "loanId") REFERENCES "Loans" ("cooperativeId", id),
          CHECK ("principal" + "interest" > 0)
        );

        INSERT INTO "SchemaMigrations" (version) VALUES ('002_financial_postings');
      `);
    }

    const [staff] = await run(`SELECT version FROM "SchemaMigrations" WHERE version = '003_staff_and_audit'`);
    if (staff.length === 0) {
      await run(`
        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true;
        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "permissions" text[] NOT NULL DEFAULT '{}';
        ALTER TABLE "Loans" ADD COLUMN IF NOT EXISTS "requestedBy" uuid;
        ALTER TABLE "Loans" ADD COLUMN IF NOT EXISTS "decidedBy" uuid;
        ALTER TABLE "Loans" ADD FOREIGN KEY ("cooperativeId", "requestedBy") REFERENCES "Users" ("cooperativeId", id);
        ALTER TABLE "Loans" ADD FOREIGN KEY ("cooperativeId", "decidedBy") REFERENCES "Users" ("cooperativeId", id);

        CREATE TABLE "AuditEvents" (
          id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          "cooperativeId" uuid NOT NULL REFERENCES "Cooperatives"(id),
          "actorId" uuid NOT NULL,
          action text NOT NULL,
          "recordId" uuid NOT NULL,
          details jsonb NOT NULL DEFAULT '{}',
          "createdAt" timestamptz NOT NULL DEFAULT now(),
          FOREIGN KEY ("cooperativeId", "actorId") REFERENCES "Users" ("cooperativeId", id)
        );
        CREATE INDEX audit_events_cooperative_history ON "AuditEvents" ("cooperativeId", id DESC);
        CREATE TRIGGER immutable_audit_events
          BEFORE UPDATE OR DELETE ON "AuditEvents"
          FOR EACH ROW EXECUTE FUNCTION reject_financial_posting_change();
        INSERT INTO "SchemaMigrations" (version) VALUES ('003_staff_and_audit');
      `);
    }

    const [payments] = await run(`SELECT version FROM "SchemaMigrations" WHERE version = '004_test_payments'`);
    if (payments.length === 0) {
      await run(`
      CREATE TABLE "PaymentIntents" (
        reference varchar(80) PRIMARY KEY,
        "cooperativeId" uuid NOT NULL,
        "memberId" uuid NOT NULL,
        "requestedBy" uuid NOT NULL,
        provider text NOT NULL CHECK (provider = 'paystack_test'),
        amount numeric(10,2) NOT NULL CHECK (amount > 0),
        currency char(3) NOT NULL CHECK (currency = 'NGN'),
        "transactionId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "completedAt" timestamptz,
        FOREIGN KEY ("cooperativeId", "memberId") REFERENCES "Members" ("cooperativeId", id),
        FOREIGN KEY ("cooperativeId", "requestedBy") REFERENCES "Users" ("cooperativeId", id),
        FOREIGN KEY ("cooperativeId", "transactionId") REFERENCES "Transactions" ("cooperativeId", id),
        CHECK (("transactionId" IS NULL) = ("completedAt" IS NULL))
      );
      CREATE INDEX payment_intent_member_history ON "PaymentIntents" ("cooperativeId", "memberId", "createdAt");
      INSERT INTO "SchemaMigrations" (version) VALUES ('004_test_payments');
      `);
    }

    const [platform] = await run(`SELECT version FROM "SchemaMigrations" WHERE version = '005_platform_owner'`);
    if (platform.length === 0) {
      await run(`
        ALTER TYPE "enum_Users_role" ADD VALUE IF NOT EXISTS 'platform_owner';
        ALTER TABLE "Cooperatives" ADD COLUMN IF NOT EXISTS "suspendedAt" timestamptz;
        CREATE TABLE "PlatformAuditEvents" (
          id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          "actorId" uuid NOT NULL REFERENCES "Users"(id),
          "cooperativeId" uuid NOT NULL REFERENCES "Cooperatives"(id),
          action text NOT NULL CHECK (action IN ('tenant.suspended', 'tenant.reactivated')),
          "createdAt" timestamptz NOT NULL DEFAULT now()
        );
        CREATE TRIGGER immutable_platform_audit
          BEFORE UPDATE OR DELETE ON "PlatformAuditEvents"
          FOR EACH ROW EXECUTE FUNCTION reject_financial_posting_change();
        INSERT INTO "SchemaMigrations" (version) VALUES ('005_platform_owner');
      `);
    }
    const [saas] = await run(`SELECT version FROM "SchemaMigrations" WHERE version = '006_saas_billing'`);
    if (saas.length === 0) {
      await run(saasSchema);
      await run(`INSERT INTO "SchemaMigrations" (version) VALUES ('006_saas_billing')`);
    }
  });
}

migrate().then(
  () => console.log('Database migrations applied'),
  (error: Error) => {
    console.error('Database migration failed:', error.message);
    process.exitCode = 1;
  }
).finally(() => sequelize.close());

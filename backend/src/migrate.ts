import sequelize from './config/database';
import './models';
import './models/Session';

async function migrate() {
  await sequelize.transaction(async transaction => {
    const run = (sql: string) => sequelize.query(sql, { transaction });

    await run('SELECT pg_advisory_xact_lock(2114826001)');
    await run('CREATE TABLE IF NOT EXISTS "SchemaMigrations" (version text PRIMARY KEY)');
    const [applied] = await run(`SELECT version FROM "SchemaMigrations" WHERE version = '001_cooperative_foundation'`);
    if (applied.length > 0) return;

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
  });
}

migrate().then(
  () => console.log('Database migrations applied'),
  (error: Error) => {
    console.error('Database migration failed:', error.message);
    process.exitCode = 1;
  }
).finally(() => sequelize.close());

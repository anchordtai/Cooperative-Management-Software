export const saasSchema = `
  CREATE TABLE "SubscriptionPlans" (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    "maximumMembers" integer CHECK ("maximumMembers" IS NULL OR "maximumMembers" > 0),
    "monthlyMinor" bigint CHECK ("monthlyMinor" > 0),
    "annualMinor" bigint CHECK ("annualMinor" > 0),
    currency char(3) NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
    features text[] NOT NULL DEFAULT '{}',
    "displayOrder" integer NOT NULL,
    active boolean NOT NULL DEFAULT true,
    recommended boolean NOT NULL DEFAULT false,
    "customPricing" boolean NOT NULL DEFAULT false,
    "trialDays" integer NOT NULL DEFAULT 0 CHECK ("trialDays" BETWEEN 0 AND 90),
    "graceDays" integer NOT NULL DEFAULT 0 CHECK ("graceDays" BETWEEN 0 AND 30),
    "updatedAt" timestamptz NOT NULL DEFAULT now()
  );
  INSERT INTO "SubscriptionPlans" (slug, name, description, "maximumMembers", "displayOrder", "customPricing")
    VALUES ('seed', 'Seed', 'For small and newly established cooperatives.', 100, 1, false),
      ('growth', 'Growth', 'For growing cooperative societies.', 250, 2, false),
      ('scale', 'Scale', 'For established and expanding cooperatives.', 500, 3, false),
      ('enterprise', 'Enterprise', 'For large cooperative organisations.', 1000, 4, false),
      ('enterprise-plus', 'Enterprise Plus', 'For institutional and high-capacity organisations.', NULL, 5, true);
  CREATE UNIQUE INDEX one_recommended_plan ON "SubscriptionPlans" (recommended) WHERE recommended;

  CREATE TABLE "CooperativeSubscriptions" (
    "cooperativeId" uuid PRIMARY KEY REFERENCES "Cooperatives"(id),
    "planId" integer NOT NULL REFERENCES "SubscriptionPlans"(id),
    "maximumMembers" integer CHECK ("maximumMembers" IS NULL OR "maximumMembers" > 0),
    cycle text CHECK (cycle IN ('monthly','annual')),
    "startsAt" timestamptz NOT NULL,
    "endsAt" timestamptz NOT NULL CHECK ("endsAt" > "startsAt"),
    "graceDays" integer NOT NULL DEFAULT 0 CHECK ("graceDays" BETWEEN 0 AND 30),
    trial boolean NOT NULL DEFAULT false,
    "cancelledAt" timestamptz,
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0)
  );

  CREATE TABLE "SubscriptionPayments" (
    reference text PRIMARY KEY,
    "cooperativeId" uuid NOT NULL REFERENCES "Cooperatives"(id),
    "actorId" uuid NOT NULL,
    "planId" integer NOT NULL REFERENCES "SubscriptionPlans"(id),
    "planName" text NOT NULL,
    "maximumMembers" integer CHECK ("maximumMembers" IS NULL OR "maximumMembers" > 0),
    "graceDays" integer NOT NULL CHECK ("graceDays" BETWEEN 0 AND 30),
    "expectedRevision" integer NOT NULL CHECK ("expectedRevision" >= 0),
    cycle text NOT NULL CHECK (cycle IN ('monthly','annual')),
    gateway text NOT NULL CHECK (gateway IN ('paystack','flutterwave')),
    mode text NOT NULL CHECK (mode IN ('test','live')),
    "amountMinor" bigint NOT NULL CHECK ("amountMinor" > 0),
    currency char(3) NOT NULL CHECK (currency = 'NGN'),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','failed','paid','review')),
    "providerId" text,
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    "paidAt" timestamptz,
    "periodStart" timestamptz,
    "periodEnd" timestamptz,
    FOREIGN KEY ("cooperativeId", "actorId") REFERENCES "Users" ("cooperativeId", id),
    UNIQUE (gateway, mode, "providerId")
  );
  CREATE INDEX subscription_payments_tenant_history
    ON "SubscriptionPayments" ("cooperativeId", "createdAt" DESC, reference);

  CREATE TABLE "SubscriptionHistory" (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "cooperativeId" uuid REFERENCES "Cooperatives"(id),
    "actorId" uuid REFERENCES "Users"(id),
    action text NOT NULL,
    reference text REFERENCES "SubscriptionPayments"(reference),
    details jsonb NOT NULL DEFAULT '{}',
    "createdAt" timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX subscription_history_tenant ON "SubscriptionHistory" ("cooperativeId", id DESC);
  CREATE TRIGGER immutable_subscription_history BEFORE UPDATE OR DELETE ON "SubscriptionHistory"
    FOR EACH ROW EXECUTE FUNCTION reject_financial_posting_change();

  CREATE TABLE "BillingNotifications" (
    key text PRIMARY KEY,
    "cooperativeId" uuid NOT NULL REFERENCES "Cooperatives"(id),
    "recipientId" uuid NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    attempts integer NOT NULL DEFAULT 0,
    "nextAttemptAt" timestamptz NOT NULL DEFAULT now(),
    "sentAt" timestamptz,
    FOREIGN KEY ("cooperativeId", "recipientId") REFERENCES "Users" ("cooperativeId", id)
  );
  CREATE INDEX billing_notifications_due ON "BillingNotifications" ("nextAttemptAt")
    WHERE "sentAt" IS NULL AND attempts < 5;
  CREATE TABLE "BillingWebhookEvents" (
    gateway text NOT NULL,
    digest text NOT NULL,
    reference text NOT NULL REFERENCES "SubscriptionPayments"(reference),
    outcome text NOT NULL,
    "receivedAt" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (gateway, digest)
  );
  CREATE TRIGGER immutable_billing_webhooks BEFORE UPDATE OR DELETE ON "BillingWebhookEvents"
    FOR EACH ROW EXECUTE FUNCTION reject_financial_posting_change();

  CREATE TABLE "MemberImportHistory" (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "cooperativeId" uuid NOT NULL REFERENCES "Cooperatives"(id),
    "actorId" uuid NOT NULL,
    "requestId" uuid NOT NULL,
    digest text NOT NULL,
    result jsonb NOT NULL,
    "createdAt" timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY ("cooperativeId", "actorId") REFERENCES "Users" ("cooperativeId", id),
    UNIQUE ("cooperativeId", "requestId")
  );
  CREATE INDEX member_import_history_tenant ON "MemberImportHistory" ("cooperativeId", id DESC);
  CREATE TRIGGER immutable_member_import_history BEFORE UPDATE OR DELETE ON "MemberImportHistory"
    FOR EACH ROW EXECUTE FUNCTION reject_financial_posting_change();
`;

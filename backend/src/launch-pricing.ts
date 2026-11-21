// All published amounts are in Nigerian kobo.
export const launchPricing = `
  WITH launch(slug, monthly, annual) AS (VALUES
    ('seed', 750000, 7500000),
    ('growth', 1500000, 15000000),
    ('scale', 2500000, 25000000),
    ('enterprise', 4000000, 40000000)
  )
  UPDATE "SubscriptionPlans" p SET
    "monthlyMinor" = COALESCE(p."monthlyMinor", launch.monthly),
    "annualMinor" = COALESCE(p."annualMinor", launch.annual),
    "trialDays" = CASE WHEN p."trialDays" = 0 THEN 14 ELSE p."trialDays" END,
    features = CASE WHEN cardinality(p.features) = 0 THEN ARRAY[
      'Member management and member portal',
      'Savings, contributions and transactions',
      'Loan management and financial reports',
      'CSV and Excel member import',
      'Audit history and staff access'
    ] ELSE p.features END,
    "updatedAt" = now()
  FROM launch WHERE p.slug = launch.slug AND NOT p."customPricing";

  CREATE TABLE "BillingGatewayControls" (
    gateway text PRIMARY KEY CHECK (gateway IN ('paystack', 'flutterwave')),
    paused boolean NOT NULL DEFAULT false
  );
  INSERT INTO "BillingGatewayControls" (gateway) VALUES ('paystack'), ('flutterwave');

  INSERT INTO "SubscriptionHistory" (action, details)
  VALUES ('catalog.launch_pricing', '{"currency":"NGN","plans":["seed","growth","scale","enterprise"]}'::jsonb);
`;

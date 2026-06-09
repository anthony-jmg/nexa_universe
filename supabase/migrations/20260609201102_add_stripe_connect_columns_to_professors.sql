ALTER TABLE professors
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS platform_fee_percentage integer DEFAULT 20;

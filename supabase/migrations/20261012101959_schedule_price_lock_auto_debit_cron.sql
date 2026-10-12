/*
# Scheduled cron job for Price Lock automatic balance debits

1. Plain-English summary
   Schedules the pg_cron job that calls the `debit-price-lock-balances` Edge
   Function every ten minutes. The job charges the remaining balance of Price
   Locks configured with the "automatic" payment mode, at their due date
   (auto_balance_payment_at), using Stripe off-session PaymentIntents. The
   existing Stripe webhook finalizes each payment.

2. New table `price_lock_job_settings`
   - key (text, primary key), value (text).
   - Holds two settings: 'function_url' (full URL of the Edge Function) and
     'cron_secret' (shared secret between cron and the function).
   - RLS ENABLED with NO policies: anon and authenticated can read nothing;
     only the service role (Edge Function, migrations) and the cron job can
     access it. The secret is never exposed to the browser.
   - 'cron_secret' is generated inside the database with pgcrypto
     (gen_random_bytes), so it never appears in any client, log or transcript.

3. New function `cron_debit_config(p_key text)`
   - SECURITY DEFINER helper reading the settings table, used only by the cron
     command to build the HTTP call at execution time (URL + secret header).
   - Revoked from PUBLIC, anon and authenticated; service role + cron only.

4. Schedule (pg_cron + pg_net)
   - Job name `debit-price-lock-balances`, every ten minutes, same cadence as
     the existing cleanup jobs. pg_net performs the asynchronous HTTPS POST;
     the Edge Function does the actual charging.
   - The Edge Function re-validates everything server-side at execution time
     via the atomic claim, so an early manual payment, cancellation or expiry
     always wins over the automatic debit. Never triggered from the browser.

5. Security notes
   - No change to existing tables or policies; purely additive.
   - No card data stored anywhere — Stripe identifiers only.
*/

CREATE TABLE IF NOT EXISTS price_lock_job_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE price_lock_job_settings ENABLE ROW LEVEL SECURITY;
-- Aucune policy : table lisible/inscriptible uniquement par le service role
-- (RLS bypass) et le cron. anon/authenticated n'ont accès à rien.

INSERT INTO price_lock_job_settings (key, value)
VALUES ('cron_secret', 'nexa-cron-' || encode(gen_random_bytes(16), 'hex'))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION cron_debit_config(p_key text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM price_lock_job_settings WHERE key = p_key;
$$;

REVOKE EXECUTE ON FUNCTION cron_debit_config(text) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'debit-price-lock-balances') THEN
      PERFORM cron.unschedule('debit-price-lock-balances');
    END IF;
    PERFORM cron.schedule(
      'debit-price-lock-balances',
      '*/10 * * * *',
      $cron$
      SELECT net.http_post(
        url := (SELECT cron_debit_config('function_url')),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT cron_debit_config('cron_secret'))
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
  END IF;
END $$;

/*
# Cron debit-price-lock-balances : timeout de l'appel pg_net

1. Problème
- Le job appelait l'Edge Function via net.http_post sans timeout explicite :
  pg_net applique alors 5 000 ms par défaut.
- Démarrage à froid de la fonction + appel Stripe off-session dépassent
  régulièrement 5 s (06:20, 07:00, 07:30, 08:00 le 24/10) : la fonction
  termine normalement, mais la réponse du job est perdue
  (net._http_response : « Timeout of 5000 ms reached »).

2. Correctif (minimal)
- Même commande, même URL, mêmes en-têtes, même corps, avec
  timeout_milliseconds := 120000.
- cron.alter_job modifie uniquement la commande du job existant :
  fréquence (*/10), identifiant et état actif inchangés.
- Aucune modification de la fonction, de la sélection des locks, de Stripe,
  de l'idempotence ni des règles Price Lock.
*/

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'debit-price-lock-balances';
  IF v_job_id IS NULL THEN
    RAISE NOTICE 'Job debit-price-lock-balances introuvable : rien à modifier';
    RETURN;
  END IF;

  PERFORM cron.alter_job(
    job_id := v_job_id,
    command := $cron$
      SELECT net.http_post(
        url := (SELECT cron_debit_config('function_url')),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT cron_debit_config('cron_secret'))
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      );
    $cron$
  );
END $$;

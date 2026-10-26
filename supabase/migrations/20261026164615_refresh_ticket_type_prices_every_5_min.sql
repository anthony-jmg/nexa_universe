-- Recalcul des champs dérivés des billets toutes les 5 minutes (au lieu de
-- chaque heure) : décalage maximal ~5 min entre un nouveau palier (Shop) et
-- le moteur Price Lock. Fonction inchangée : seuls les billets désynchronisés
-- sont mis à jour.
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'refresh-ticket-type-prices'),
  schedule := '*/5 * * * *'
);

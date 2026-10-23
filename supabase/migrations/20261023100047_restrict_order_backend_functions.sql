/*
# Sécurité : fonctions de commande réservées au serveur

1. Problème
- `admin_confirm_order_payment(uuid)` (SECURITY DEFINER) ne vérifie pas le
  rôle admin et était exécutable par `anon` / `authenticated` : n'importe qui
  pouvait passer une commande en `completed` et générer ses billets sans payer.
- `reserve_stock`, `cancel_expired_orders`, `cleanup_expired_reservations` et
  `cleanup_expired_checkout_sessions` étaient aussi exécutables par tous
  (blocage de stock, annulations forcées).

2. Correctif
- EXECUTE retiré à PUBLIC / anon / authenticated, accordé au seul
  `service_role` (edge functions validate-and-create-order et
  cleanup-expired-reservations ; pg_cron s'exécute en propriétaire).
- Le front n'appelle aucune de ces fonctions.
*/

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
         'admin_confirm_order_payment',
         'reserve_stock',
         'cancel_expired_orders',
         'cleanup_expired_reservations',
         'cleanup_expired_checkout_sessions'
       )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;

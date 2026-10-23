/*
# Expiration des commandes + champs de synchronisation Weezevent

1. Cause réelle
- cancel_expired_orders() (job pg_cron 'cancel-expired-orders', toutes les
  10 min) lit orders.expires_at. Cette colonne n'existe pas en production :
  la migration 20260115161353_fix_orders_system_add_missing_columns n'y a
  jamais été appliquée (le projet a été recréé le 2026-01-21 sans les
  migrations antérieures). Le job échoue à chaque exécution depuis le
  2026-02-26 ("column expires_at does not exist") : aucune commande en
  attente n'a jamais expiré.

2. Correctif
- orders.expires_at ajoutée (1 h après création pour les nouvelles
  commandes ; commandes 'pending' existantes : created_at + 1 h).
- cancel_expired_orders réécrite : une commande n'est annulée que si
  aucune session Stripe ne peut encore être payée (session 'completed' =
  paiement différé en cours, ou session non expirée). Les réservations de
  stock sont supprimées directement (release_stock_reservation exige un
  JWT service_role, absent dans pg_cron). Les participants en attente sont
  conservés : si un paiement tardif arrive malgré tout, claim_paid_order
  livre la commande annulée normalement.
- Aucune action sur Price Lock (créé uniquement après paiement) ni
  remboursement (rien n'est encaissé sur une commande en attente).

3. Weezevent (structure seule, pas d'intégration)
- event_attendees : weezevent_participant_id, weezevent_ticket_id,
  weezevent_sync_status ('pending' | 'synced' | 'failed' | 'skipped'),
  weezevent_synced_at. Non modifiables par les clients (garde existante
  sur event_attendees : colonnes hors liste éditable).
*/

-- ═══ 1. orders.expires_at ═══

ALTER TABLE orders ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE orders
   SET expires_at = created_at + interval '1 hour'
 WHERE status = 'pending'
   AND expires_at IS NULL;

ALTER TABLE orders ALTER COLUMN expires_at SET DEFAULT (now() + interval '1 hour');

CREATE INDEX IF NOT EXISTS idx_orders_pending_expires_at
  ON orders (expires_at)
  WHERE status = 'pending';

-- ═══ 2. cancel_expired_orders ═══

CREATE OR REPLACE FUNCTION public.cancel_expired_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_order_id uuid;
BEGIN
  FOR v_order_id IN
    SELECT o.id
      FROM orders o
     WHERE o.status = 'pending'
       AND o.expires_at IS NOT NULL
       AND o.expires_at < now()
       -- Jamais pendant qu'un paiement peut encore aboutir
       AND NOT EXISTS (
         SELECT 1 FROM stripe_checkout_sessions s
          WHERE s.target_id = o.id
            AND (s.status = 'completed' OR s.expires_at IS NULL OR s.expires_at > now())
       )
     FOR UPDATE OF o SKIP LOCKED
  LOOP
    UPDATE orders
       SET status = 'cancelled',
           updated_at = now()
     WHERE id = v_order_id
       AND status = 'pending';

    DELETE FROM stock_reservations WHERE reservation_id = v_order_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END $$;

REVOKE EXECUTE ON FUNCTION public.cancel_expired_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_expired_orders() TO service_role;

-- ═══ 3. Champs Weezevent ═══

ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS weezevent_participant_id text,
  ADD COLUMN IF NOT EXISTS weezevent_ticket_id text,
  ADD COLUMN IF NOT EXISTS weezevent_sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS weezevent_synced_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'event_attendees_weezevent_sync_status_check'
       AND conrelid = 'public.event_attendees'::regclass
  ) THEN
    ALTER TABLE event_attendees
      ADD CONSTRAINT event_attendees_weezevent_sync_status_check
      CHECK (weezevent_sync_status IN ('pending', 'synced', 'failed', 'skipped'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_attendees_weezevent_ticket_id
  ON event_attendees (weezevent_ticket_id)
  WHERE weezevent_ticket_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_attendees_weezevent_to_sync
  ON event_attendees (weezevent_sync_status)
  WHERE weezevent_sync_status IN ('pending', 'failed');

/*
# Paliers tarifaires : synchronisation automatique + protections de suppression

1. Trigger sur event_ticket_price_tiers (INSERT / UPDATE / DELETE) : réenregistre
   le billet concerné, ce qui relance la logique existante
   derive_legacy_price_fields (price, next_price, price_increase_date).
   L'admin peut créer billet + paliers en une seule sauvegarde.
2. refresh_ticket_type_price_fields() + tâche planifiée horaire : recalcule les
   billets dont les champs dérivés ne correspondent plus aux paliers (hausse
   passée, fin de palier…). Le moteur Price Lock n'est pas modifié.
3. Suppression bloquée d'un événement ou d'un type de billet ayant déjà des
   Price Locks, billets, commandes, paiements ou réservations : dépublier
   l'événement ou désactiver le pass à la place.

Les Price Locks existants ne sont jamais modifiés : locked_price, total_paid,
expires_at… sont photographiés et protégés par protect_price_lock_terms.
*/

-- 1. Synchronisation billet ← paliers --------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_ticket_type_from_tiers()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Mise à jour neutre : le trigger trg_derive_legacy_price recalcule les champs.
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    UPDATE event_ticket_types SET price = price WHERE id = NEW.event_ticket_type_id;
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE')
     AND (TG_OP = 'DELETE' OR OLD.event_ticket_type_id IS DISTINCT FROM NEW.event_ticket_type_id) THEN
    UPDATE event_ticket_types SET price = price WHERE id = OLD.event_ticket_type_id;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_sync_ticket_type_from_tiers ON public.event_ticket_price_tiers;
CREATE TRIGGER trg_sync_ticket_type_from_tiers
  AFTER INSERT OR UPDATE OR DELETE ON public.event_ticket_price_tiers
  FOR EACH ROW EXECUTE FUNCTION public.sync_ticket_type_from_tiers();

-- 2. Recalcul dans le temps ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_ticket_type_price_fields()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE event_ticket_types ett
     SET price = ett.price
    FROM (
      SELECT e.id, p.current_price, p.next_price, p.next_price_change_at
        FROM event_ticket_types e
        LEFT JOIN LATERAL get_event_ticket_pricing(e.id) p ON true
       WHERE EXISTS (SELECT 1 FROM event_ticket_price_tiers t WHERE t.event_ticket_type_id = e.id)
    ) cur
   WHERE ett.id = cur.id
     AND (
       ett.next_price IS DISTINCT FROM cur.next_price
       OR ett.price_increase_date IS DISTINCT FROM cur.next_price_change_at
       OR (cur.current_price IS NOT NULL AND ett.price IS DISTINCT FROM cur.current_price)
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

REVOKE EXECUTE ON FUNCTION public.refresh_ticket_type_price_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_ticket_type_from_tiers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_ticket_type_price_fields() TO service_role;

SELECT cron.unschedule('refresh-ticket-type-prices')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-ticket-type-prices');
SELECT cron.schedule('refresh-ticket-type-prices', '0 * * * *', 'SELECT public.refresh_ticket_type_price_fields()');

-- 3. Protections de suppression -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_ticket_type_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM price_locks WHERE event_ticket_type_id = OLD.id)
     OR EXISTS (SELECT 1 FROM event_attendees WHERE event_ticket_type_id = OLD.id)
     OR EXISTS (SELECT 1 FROM pending_event_attendees WHERE event_ticket_type_id = OLD.id)
     OR EXISTS (SELECT 1 FROM order_items WHERE event_ticket_type_id = OLD.id)
     OR EXISTS (SELECT 1 FROM stock_reservations WHERE event_ticket_type_id = OLD.id) THEN
    RAISE EXCEPTION 'Suppression impossible : ce pass a déjà des Price Locks, billets, commandes ou réservations. Désactivez le pass à la place.';
  END IF;
  RETURN OLD;
END $$;

CREATE OR REPLACE FUNCTION public.guard_event_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM price_locks WHERE event_id = OLD.id)
     OR EXISTS (SELECT 1 FROM event_attendees WHERE event_id = OLD.id)
     OR EXISTS (SELECT 1 FROM pending_event_attendees WHERE event_id = OLD.id)
     OR EXISTS (SELECT 1 FROM order_items oi JOIN event_ticket_types ett ON ett.id = oi.event_ticket_type_id
                 WHERE ett.event_id = OLD.id)
     OR EXISTS (SELECT 1 FROM stock_reservations sr JOIN event_ticket_types ett ON ett.id = sr.event_ticket_type_id
                 WHERE ett.event_id = OLD.id) THEN
    RAISE EXCEPTION 'Suppression impossible : cet événement a déjà des Price Locks, billets, commandes ou réservations. Dépubliez l''événement à la place.';
  END IF;
  RETURN OLD;
END $$;

REVOKE EXECUTE ON FUNCTION public.guard_ticket_type_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_event_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_ticket_type_delete ON public.event_ticket_types;
CREATE TRIGGER trg_guard_ticket_type_delete
  BEFORE DELETE ON public.event_ticket_types
  FOR EACH ROW EXECUTE FUNCTION public.guard_ticket_type_delete();

DROP TRIGGER IF EXISTS trg_guard_event_delete ON public.events;
CREATE TRIGGER trg_guard_event_delete
  BEFORE DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.guard_event_delete();

-- 4. Rattrapage immédiat des billets existants (même logique que la tâche horaire).
SELECT public.refresh_ticket_type_price_fields();

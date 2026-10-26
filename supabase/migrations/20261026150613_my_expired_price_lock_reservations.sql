-- Mes Pass : billets de réservation annulés à l'expiration d'un Price Lock,
-- à masquer côté client (aucune donnée modifiée, visibles en base et admin).
-- Lien exact lock → billet de réservation :
--   - achat direct : qr_code = 'PL-' || lock.id (ensure_price_lock_attendee) ;
--   - panier : lock.order_item_id → order_items.order_id, qr_code
--     'EVT-<order_id>-<ticket_type_id>-…' (validate-and-create-order).
-- Commande contenant le même billet sous un autre mode d'achat : ambigu,
-- rien n'est masqué.
CREATE OR REPLACE FUNCTION public.get_my_expired_price_lock_reservation_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT a.id
    FROM price_locks pl
    JOIN event_attendees a
      ON a.user_id = pl.user_id
     AND a.event_ticket_type_id = pl.event_ticket_type_id
     AND a.check_in_status = 'cancelled'
    LEFT JOIN order_items oi ON oi.id = pl.order_item_id
   WHERE pl.user_id = auth.uid()
     AND pl.status = 'expired'
     AND (
       a.qr_code = 'PL-' || pl.id::text
       OR (
         oi.purchase_type = 'price_lock_deposit'
         AND a.qr_code LIKE 'EVT-' || oi.order_id::text || '-' || pl.event_ticket_type_id::text || '-%'
         AND NOT EXISTS (
           SELECT 1 FROM order_items o2
            WHERE o2.order_id = oi.order_id
              AND o2.event_ticket_type_id = pl.event_ticket_type_id
              AND o2.id <> oi.id
         )
       )
     );
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_expired_price_lock_reservation_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_expired_price_lock_reservation_ids() TO authenticated, service_role;

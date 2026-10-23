/*
# Commandes & Price Lock : traitement unique du paiement et cycle de vie du lock

1. Problèmes
- Le webhook Stripe et verify-payment traitaient la même commande en
  parallèle, sans verrou : stock décrémenté plusieurs fois, configuration du
  prélèvement automatique perdue selon l'ordre d'arrivée.
- Le statut 'paid' (commandes avec produit physique) n'est pas autorisé par
  orders_status_check : la commande restait 'pending'.
- Le stock réel est par taille (product_sizes.stock_quantity) ; le webhook
  décrémentait products.stock_quantity, colonne inexistante.
- release_stock_reservation, appelée par le front et le webhook, n'existait pas.
- Un Price Lock soldé ne comptait plus dans le quota (ni lock actif, ni
  quantity_sold) : la place était remise en vente.
- Un lock expiré ou annulé laissait le billet en 'awaiting_balance'.

2. Correctifs
- claim_paid_order : verrouille la commande, vérifie propriétaire et montant
  encaissé, la passe en 'processing' (produit physique) ou 'completed',
  décrémente le stock par taille et libère les réservations, en une seule
  transaction. Un deuxième appel renvoie 'already_processed'.
- release_stock_reservation : recréée, limitée au propriétaire d'une commande
  en attente/annulée (ou au service role).
- Trigger trg_price_locks_status_change :
  active -> completed : quantity_sold + 1 ;
  active -> expired / cancelled : billet 'awaiting_balance' -> 'cancelled'.
*/

-- ═══ 1. Traitement atomique d'une commande payée ═══

CREATE OR REPLACE FUNCTION public.claim_paid_order(
  p_order_id uuid,
  p_user_id uuid,
  p_amount_paid numeric,
  p_payment_intent_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o orders;
  v_status text;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR o.user_id IS DISTINCT FROM p_user_id THEN
    RETURN 'not_found';
  END IF;
  -- Une commande annulée (abandon, expiration) puis payée reste livrable.
  IF o.status NOT IN ('pending', 'cancelled') THEN
    RETURN 'already_processed';
  END IF;
  IF p_amount_paid IS NULL OR abs(p_amount_paid - o.total_amount) >= 0.01 THEN
    RETURN 'amount_mismatch';
  END IF;

  v_status := CASE
    WHEN EXISTS (
      SELECT 1 FROM order_items
       WHERE order_id = p_order_id AND item_type = 'product' AND product_id IS NOT NULL
    ) THEN 'processing'
    ELSE 'completed'
  END;

  UPDATE orders
     SET status = v_status,
         stripe_payment_intent_id = p_payment_intent_id,
         updated_at = now()
   WHERE id = p_order_id;

  UPDATE product_sizes ps
     SET stock_quantity = GREATEST(ps.stock_quantity - oi.qty, 0)
    FROM (
      SELECT product_id, selected_size, sum(quantity) AS qty
        FROM order_items
       WHERE order_id = p_order_id
         AND item_type = 'product'
         AND product_id IS NOT NULL
         AND selected_size IS NOT NULL
       GROUP BY product_id, selected_size
    ) oi
   WHERE ps.product_id = oi.product_id
     AND ps.name = oi.selected_size;

  DELETE FROM stock_reservations WHERE reservation_id = p_order_id;

  RETURN v_status;
END $$;

REVOKE EXECUTE ON FUNCTION public.claim_paid_order(uuid, uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_paid_order(uuid, uuid, numeric, text) TO service_role;

-- ═══ 2. Libération des réservations de stock ═══

CREATE OR REPLACE FUNCTION public.release_stock_reservation(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM orders
        WHERE id = p_order_id
          AND user_id = auth.uid()
          AND status IN ('pending', 'cancelled')
     ) THEN
    RETURN;
  END IF;

  DELETE FROM stock_reservations WHERE reservation_id = p_order_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.release_stock_reservation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_stock_reservation(uuid) TO authenticated, service_role;

-- ═══ 3. Cycle de vie d'un Price Lock ═══

CREATE OR REPLACE FUNCTION public.on_price_lock_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'active' AND NEW.status = 'completed' THEN
    -- Le lock actif réservait la place ; une fois soldé, elle devient vendue.
    UPDATE event_ticket_types
       SET quantity_sold = quantity_sold + 1
     WHERE id = NEW.event_ticket_type_id;
  ELSIF OLD.status = 'active' AND NEW.status IN ('expired', 'cancelled') THEN
    UPDATE event_attendees
       SET check_in_status = 'cancelled'
     WHERE user_id = NEW.user_id
       AND event_ticket_type_id = NEW.event_ticket_type_id
       AND check_in_status = 'awaiting_balance';
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.on_price_lock_status_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_price_locks_status_change ON price_locks;
CREATE TRIGGER trg_price_locks_status_change
  AFTER UPDATE OF status ON price_locks
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION on_price_lock_status_change();

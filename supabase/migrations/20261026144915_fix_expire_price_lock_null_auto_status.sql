-- Correctif : sans débit automatique (auto_balance_payment_status NULL), la
-- condition « débit en cours » valait NULL et NOT NULL excluait la ligne :
-- les locks à solde manuel n'expiraient jamais. COALESCE → false.
CREATE OR REPLACE FUNCTION public.expire_price_lock_if_due(p_lock_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  UPDATE price_locks pl
     SET status = 'expired',
         remaining_amount = GREATEST(0, COALESCE(price_lock_public_price(pl.event_ticket_type_id), pl.locked_price) - pl.total_paid),
         updated_at = now()
   WHERE pl.id = p_lock_id
     AND pl.status = 'active'
     AND pl.expires_at <= now()
     -- Un débit automatique lancé avant la date limite (< 2 h) peut se terminer.
     AND NOT COALESCE(pl.auto_balance_payment_status = 'processing'
                      AND pl.auto_balance_debit_attempted_at > now() - interval '2 hours', false);
  RETURN FOUND;
END $$;

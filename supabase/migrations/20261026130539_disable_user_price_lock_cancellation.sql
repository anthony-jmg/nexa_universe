-- Décision produit : un utilisateur ne peut pas annuler volontairement un Price Lock.
-- cancel_price_lock et price_lock_refund_eligible sont conservées pour les
-- interventions admin / techniques (service_role), mais ne sont plus
-- appelables par un client connecté.
REVOKE EXECUTE ON FUNCTION public.cancel_price_lock(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.price_lock_refund_eligible(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_price_lock(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.price_lock_refund_eligible(uuid) TO service_role;

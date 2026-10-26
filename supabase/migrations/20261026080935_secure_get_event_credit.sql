/*
# get_event_credit : lecture limitée à ses propres données

1. Problème
- get_event_credit(p_user_id, p_event_id) est SECURITY DEFINER et exécutable
  par tout utilisateur connecté : n'importe qui pouvait lire le crédit Price
  Lock (locks expirés / annulés non remboursés) d'un autre utilisateur.

2. Correctif
- Même signature, même calcul. Appel via l'API (rôle JWT anon /
  authenticated) : p_user_id doit être l'utilisateur connecté, sauf admin.
- Backend (service_role, appels SQL internes sans JWT) inchangé.
- anon : EXECUTE retiré (déjà le cas) ; authenticated conservé.
*/

CREATE OR REPLACE FUNCTION public.get_event_credit(p_user_id uuid, p_event_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  credit numeric;
BEGIN
  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated')
     AND p_user_id IS DISTINCT FROM auth.uid()
     AND NOT nexa_caller_is_admin() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(pl.total_paid), 0) INTO credit
  FROM price_locks pl
  WHERE pl.user_id = p_user_id
    AND pl.event_id = p_event_id
    AND pl.status IN ('expired', 'cancelled')
    AND pl.refund_processed_at IS NULL;
  RETURN credit;
END
$$;

REVOKE EXECUTE ON FUNCTION public.get_event_credit(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_credit(uuid, uuid) TO authenticated, service_role;

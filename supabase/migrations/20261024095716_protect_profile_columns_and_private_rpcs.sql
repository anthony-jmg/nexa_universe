/*
# Profils et professeurs : colonnes protégées en écriture + accès privés par RPC

1. Problème
- Les politiques UPDATE « propre ligne » de `profiles` et `professors` ne
  restreignaient aucune colonne : un utilisateur pouvait se donner
  role = 'admin' ou un abonnement actif, un professeur modifier son compte
  Stripe Connect ou sa commission.

2. Écriture (triggers BEFORE INSERT/UPDATE, politiques inchangées)
- profiles : role, email, champs d'abonnement et Stripe modifiables
  uniquement par un admin ou par le backend (service_role, fonctions
  SECURITY DEFINER) ; professor_request_status ne peut être passé qu'à
  'pending' par l'utilisateur lui-même.
- professors : stripe_connect_*, platform_fee_percentage, is_founder,
  is_featured et badge_type réservés à l'admin et au backend.

3. Lecture privée (préparation du retrait des droits publics)
- get_my_profile() : ligne complète de l'utilisateur connecté uniquement.
- admin_list_profiles() : liste complète, refusée hors admin.
*/

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM profiles WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_profiles()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT nexa_caller_is_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM profiles ORDER BY created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_profiles() TO authenticated;

-- ═══ 2. Écriture ═══

-- SECURITY INVOKER : current_user est le rôle de l'appelant (anon /
-- authenticated via l'API ; postgres ou service_role pour le backend).
CREATE OR REPLACE FUNCTION public.protect_profile_private_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF current_user = 'authenticated' AND nexa_caller_is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS DISTINCT FROM 'student'
       OR NEW.platform_subscription_status IS DISTINCT FROM 'inactive'
       OR NEW.platform_subscription_expires_at IS NOT NULL
       OR COALESCE(NEW.platform_subscription_price_paid, 0) <> 0
       OR NEW.stripe_subscription_id IS NOT NULL
       OR NEW.stripe_price_id IS NOT NULL
       OR COALESCE(NEW.subscription_cancel_at_period_end, false)
       OR NEW.professor_request_status IS DISTINCT FROM NULL
          AND NEW.professor_request_status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'Champs de profil réservés à l''administration' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.platform_subscription_status IS DISTINCT FROM OLD.platform_subscription_status
     OR NEW.platform_subscription_expires_at IS DISTINCT FROM OLD.platform_subscription_expires_at
     OR NEW.platform_subscription_price_paid IS DISTINCT FROM OLD.platform_subscription_price_paid
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.stripe_price_id IS DISTINCT FROM OLD.stripe_price_id
     OR NEW.subscription_cancel_at_period_end IS DISTINCT FROM OLD.subscription_cancel_at_period_end
     OR (NEW.professor_request_status IS DISTINCT FROM OLD.professor_request_status
         AND NEW.professor_request_status IS DISTINCT FROM 'pending') THEN
    RAISE EXCEPTION 'Champs de profil réservés à l''administration' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_private_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_private_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_private_columns();

CREATE OR REPLACE FUNCTION public.protect_professor_admin_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF current_user = 'authenticated' AND nexa_caller_is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.stripe_connect_account_id IS NOT NULL
       OR COALESCE(NEW.stripe_connect_onboarding_completed, false)
       OR COALESCE(NEW.stripe_connect_enabled, false)
       OR COALESCE(NEW.stripe_connect_charges_enabled, false)
       OR NEW.platform_fee_percentage IS DISTINCT FROM 20.00
       OR COALESCE(NEW.is_founder, false)
       OR COALESCE(NEW.is_featured, false)
       OR NEW.badge_type IS NOT NULL THEN
      RAISE EXCEPTION 'Champs professeur réservés à l''administration' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.stripe_connect_account_id IS DISTINCT FROM OLD.stripe_connect_account_id
     OR NEW.stripe_connect_onboarding_completed IS DISTINCT FROM OLD.stripe_connect_onboarding_completed
     OR NEW.stripe_connect_enabled IS DISTINCT FROM OLD.stripe_connect_enabled
     OR NEW.stripe_connect_charges_enabled IS DISTINCT FROM OLD.stripe_connect_charges_enabled
     OR NEW.platform_fee_percentage IS DISTINCT FROM OLD.platform_fee_percentage
     OR NEW.is_founder IS DISTINCT FROM OLD.is_founder
     OR NEW.is_featured IS DISTINCT FROM OLD.is_featured
     OR NEW.badge_type IS DISTINCT FROM OLD.badge_type THEN
    RAISE EXCEPTION 'Champs professeur réservés à l''administration' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_professor_admin_columns ON public.professors;
CREATE TRIGGER trg_protect_professor_admin_columns
  BEFORE INSERT OR UPDATE ON public.professors
  FOR EACH ROW EXECUTE FUNCTION public.protect_professor_admin_columns();

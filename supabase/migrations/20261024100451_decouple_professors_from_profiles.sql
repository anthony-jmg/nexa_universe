/*
# Professeurs Discovery indépendants des comptes utilisateurs

1. Problème
- professors.id était une clé étrangère vers profiles.id (elle-même liée à
  auth.users) : impossible de créer une fiche professeur sans créer un
  utilisateur. Le nom et l'avatar n'existaient que dans profiles.

2. Modèle
- professors.id : UUID propre (gen_random_uuid()) pour les fiches Discovery.
- profile_id (nullable, unique) -> profiles(id) ON DELETE CASCADE : renseigné
  uniquement pour un ancien professeur lié à un compte (profile_id = id).
  Les jointures historiques professors -> profiles passent désormais par
  cette colonne.
- Nouvelles colonnes : full_name, avatar_url, is_active (true), updated_at.

3. Compatibilité ancienne Academy
- Tout INSERT dont l'id correspond à un profil existant (dashboard
  professeur, demande approuvée, create_professor_entry) est lié
  automatiquement : profile_id = id, nom et avatar recopiés.
- Politiques « propre ligne » inchangées (id = auth.uid() pour l'historique).

4. Sécurité
- Lecture publique limitée aux fiches actives ; l'admin voit tout.
- profile_id et is_active réservés à l'admin et au backend.
*/

ALTER TABLE public.professors ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.professors
  ADD COLUMN IF NOT EXISTS profile_id uuid,
  ADD COLUMN IF NOT EXISTS full_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Anciens professeurs (aucun en production à date) : lien et identité.
UPDATE public.professors pr
   SET profile_id = pr.id,
       full_name = COALESCE(NULLIF(pr.full_name, ''), p.full_name, ''),
       avatar_url = COALESCE(pr.avatar_url, NULLIF(p.avatar_url, ''))
  FROM public.profiles p
 WHERE p.id = pr.id
   AND pr.profile_id IS NULL;

ALTER TABLE public.professors DROP CONSTRAINT IF EXISTS professors_id_fkey;
ALTER TABLE public.professors DROP CONSTRAINT IF EXISTS professors_profile_id_fkey;
ALTER TABLE public.professors
  ADD CONSTRAINT professors_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.professors DROP CONSTRAINT IF EXISTS professors_profile_id_key;
ALTER TABLE public.professors
  ADD CONSTRAINT professors_profile_id_key UNIQUE (profile_id);

-- ═══ Lien automatique des anciens professeurs ═══

CREATE OR REPLACE FUNCTION public.link_legacy_professor_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
BEGIN
  IF NEW.profile_id IS NULL THEN
    SELECT * INTO v_profile FROM profiles WHERE id = NEW.id;
    IF FOUND THEN
      NEW.profile_id := NEW.id;
      IF COALESCE(NEW.full_name, '') = '' THEN
        NEW.full_name := COALESCE(v_profile.full_name, '');
      END IF;
      IF NEW.avatar_url IS NULL THEN
        NEW.avatar_url := NULLIF(v_profile.avatar_url, '');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_legacy_professor_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_link_legacy_professor_profile ON public.professors;
CREATE TRIGGER trg_link_legacy_professor_profile
  BEFORE INSERT ON public.professors
  FOR EACH ROW EXECUTE FUNCTION public.link_legacy_professor_profile();

CREATE OR REPLACE FUNCTION public.touch_professors_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_professors_updated_at ON public.professors;
CREATE TRIGGER trg_touch_professors_updated_at
  BEFORE UPDATE ON public.professors
  FOR EACH ROW EXECUTE FUNCTION public.touch_professors_updated_at();

-- create_professor_entry (historique) : profile_id et identité explicites.
CREATE OR REPLACE FUNCTION public.create_professor_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.role = 'professor')
     OR (TG_OP = 'UPDATE' AND NEW.role = 'professor' AND OLD.role != 'professor') THEN
    INSERT INTO professors (id, profile_id, full_name, avatar_url)
    VALUES (NEW.id, NEW.id, COALESCE(NEW.full_name, ''), NULLIF(NEW.avatar_url, ''))
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- ═══ Colonnes réservées à l'admin (complète la protection existante) ═══

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
       OR NEW.badge_type IS NOT NULL
       OR NEW.profile_id IS DISTINCT FROM auth.uid()
       OR NOT NEW.is_active THEN
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
     OR NEW.badge_type IS DISTINCT FROM OLD.badge_type
     OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
     OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Champs professeur réservés à l''administration' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- ═══ Lecture publique : fiches actives uniquement ═══

DROP POLICY IF EXISTS "Public can view professors" ON public.professors;
CREATE POLICY "Public can view professors"
  ON public.professors FOR SELECT
  TO public
  USING (is_active = true);

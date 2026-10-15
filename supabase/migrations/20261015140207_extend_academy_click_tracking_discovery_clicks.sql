/*
# Suivi des clics Academy Discovery (réutilise academy_click_tracking)

1. Modified Tables
- `academy_click_tracking`
  - `content_type` accepte désormais aussi `academy_profile_click` et `academy_website_click`
  - `content_id` devient facultatif (non utilisé pour ces deux événements)
  - `destination_url` devient facultatif (rempli seulement pour academy_website_click)
  - `user_id` prend par défaut l'utilisateur connecté (null pour un visiteur)
  - Nouvel index (professor_id, content_type) pour le comptage

2. New Functions
- `get_academy_discovery_click_stats()` : renvoie par professeur le total des clics profil et site.
  SECURITY INVOKER : la lecture reste soumise à la règle existante "Admins can view academy clicks",
  donc un non-admin obtient zéro ligne.

3. Security
- Règle d'insertion resserrée : user_id doit être null ou celui de l'utilisateur connecté,
  type d'événement limité aux valeurs autorisées, URL limitée à 2048 caractères.
- Retrait des droits UPDATE / DELETE / TRUNCATE pour anon et authenticated
  (aucune règle ne les autorisait déjà ; double protection).
- Aucune règle SELECT ajoutée : seuls les admins lisent.

4. Notes
1. Aucune donnée supprimée ; la table était vide.
*/

ALTER TABLE public.academy_click_tracking DROP CONSTRAINT IF EXISTS academy_click_tracking_content_type_check;
ALTER TABLE public.academy_click_tracking ADD CONSTRAINT academy_click_tracking_content_type_check
  CHECK (content_type = ANY (ARRAY['program','video','academy_profile_click','academy_website_click']));

ALTER TABLE public.academy_click_tracking ALTER COLUMN content_id DROP NOT NULL;
ALTER TABLE public.academy_click_tracking ALTER COLUMN destination_url DROP NOT NULL;
ALTER TABLE public.academy_click_tracking ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_academy_click_tracking_prof_type
  ON public.academy_click_tracking (professor_id, content_type);

REVOKE UPDATE, DELETE, TRUNCATE ON public.academy_click_tracking FROM anon, authenticated;

DROP POLICY IF EXISTS "Anyone can insert academy clicks" ON public.academy_click_tracking;
CREATE POLICY "Anyone can insert academy clicks"
  ON public.academy_click_tracking FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND content_type IN ('program','video','academy_profile_click','academy_website_click')
    AND (destination_url IS NULL OR length(destination_url) <= 2048)
  );

CREATE OR REPLACE FUNCTION public.get_academy_discovery_click_stats()
RETURNS TABLE (professor_id uuid, profile_clicks bigint, website_clicks bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    t.professor_id,
    count(*) FILTER (WHERE t.content_type = 'academy_profile_click') AS profile_clicks,
    count(*) FILTER (WHERE t.content_type = 'academy_website_click') AS website_clicks
  FROM public.academy_click_tracking t
  WHERE t.content_type IN ('academy_profile_click','academy_website_click')
  GROUP BY t.professor_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_academy_discovery_click_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_academy_discovery_click_stats() TO authenticated;

/*
# Manifestations d'intérêt pour les types de billets épuisés

1. New Tables
- `event_sold_out_interests`
  - `id` (uuid, clé primaire)
  - `event_id` (uuid, événement concerné)
  - `event_ticket_type_id` (uuid, type de billet épuisé concerné)
  - `user_id` (uuid, utilisateur connecté par défaut, null pour un visiteur)
  - `created_at` (timestamptz)
  - Nom logique de l'événement suivi : event_sold_out_interest

2. Doublons
- Index unique partiel (user_id, event_ticket_type_id) quand user_id n'est pas null :
  un utilisateur connecté ne compte qu'une fois par type de billet.

3. Security
- RLS activé.
- INSERT (anon + authenticated) : seulement si user_id est null ou celui de l'utilisateur connecté,
  si le type de billet appartient bien à l'événement indiqué, et s'il est réellement épuisé
  (quantity_available non null et quantity_sold >= quantity_available).
- SELECT : réservé aux admins.
- Aucun UPDATE / DELETE : droits retirés à anon et authenticated.

4. New Functions
- `get_event_sold_out_interest_counts(p_event_id)` : total cumulé par type de billet.
  SECURITY INVOKER, donc soumise à la règle SELECT admin (un non-admin obtient zéro ligne).

5. Notes
1. Aucune suppression automatique : le compteur est un historique cumulé.
2. Le calcul de stock existant n'est pas modifié.
*/

CREATE TABLE IF NOT EXISTS public.event_sold_out_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  event_ticket_type_id uuid NOT NULL REFERENCES public.event_ticket_types(id) ON DELETE CASCADE,
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_event_sold_out_interests_user_ett
  ON public.event_sold_out_interests (user_id, event_ticket_type_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_sold_out_interests_event
  ON public.event_sold_out_interests (event_id, event_ticket_type_id);

ALTER TABLE public.event_sold_out_interests ENABLE ROW LEVEL SECURITY;

REVOKE UPDATE, DELETE, TRUNCATE ON public.event_sold_out_interests FROM anon, authenticated;

DROP POLICY IF EXISTS "Anyone can register sold out interest" ON public.event_sold_out_interests;
CREATE POLICY "Anyone can register sold out interest"
  ON public.event_sold_out_interests FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.event_ticket_types ett
      WHERE ett.id = event_sold_out_interests.event_ticket_type_id
        AND ett.event_id = event_sold_out_interests.event_id
        AND ett.quantity_available IS NOT NULL
        AND ett.quantity_sold >= ett.quantity_available
    )
  );

DROP POLICY IF EXISTS "Admins can view sold out interests" ON public.event_sold_out_interests;
CREATE POLICY "Admins can view sold out interests"
  ON public.event_sold_out_interests FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE OR REPLACE FUNCTION public.get_event_sold_out_interest_counts(p_event_id uuid)
RETURNS TABLE (event_ticket_type_id uuid, interest_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT i.event_ticket_type_id, count(*) AS interest_count
  FROM public.event_sold_out_interests i
  WHERE i.event_id = p_event_id
  GROUP BY i.event_ticket_type_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_event_sold_out_interest_counts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_sold_out_interest_counts(uuid) TO authenticated;

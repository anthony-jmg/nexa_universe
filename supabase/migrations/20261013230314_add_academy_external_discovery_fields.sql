/*
# Nexa Academy — découverte externe (site web professeur + tracking des clics)

1. Colonnes ajoutées (additif, aucune donnée modifiée ou supprimée)
- `professors.website_url` (text, nullable) — site / plateforme externe du professeur.
  Un professeur dont cette URL est valide devient éligible à la nouvelle page Academy publique.
- `programs.external_url` (text, nullable) — URL externe facultative propre à un programme.
  Si renseignée, la redirection de la nouvelle Academy pointe vers cette URL ;
  sinon vers le site du professeur.
- `videos.external_url` (text, nullable) — même logique que pour les programmes.

2. Nouvelle table
- `academy_click_tracking` : mesure simple des clics sortants envoyés par la
  nouvelle Academy vers les sites des professeurs.
  - `id` (uuid, clé primaire)
  - `professor_id` (uuid, référence professors)
  - `content_type` (text : 'program' ou 'video')
  - `content_id` (uuid, référence du contenu cliqué)
  - `destination_url` (text, URL de destination réellement ouverte)
  - `user_id` (uuid, nullable, utilisateur connecté le cas échéant)
  - `created_at` (timestamp)

3. Sécurité
- RLS activé sur `academy_click_tracking`.
- INSERT autorisé pour tous (anonyme inclus) : la nouvelle Academy est une page publique.
- SELECT réservé aux admins (consultation des clics par professeur).

4. Notes importantes
- Aucune modification de Stripe, des achats, des abonnements, de Nexa Pass ou du Price Lock.
- Migration 100 % réversible : retirer les colonnes / la table suffit à revenir en arrière.
*/

ALTER TABLE professors ADD COLUMN IF NOT EXISTS website_url text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS external_url text;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS external_url text;

CREATE TABLE IF NOT EXISTS academy_click_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('program', 'video')),
  content_id uuid NOT NULL,
  destination_url text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE academy_click_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert academy clicks" ON academy_click_tracking;
CREATE POLICY "Anyone can insert academy clicks"
ON academy_click_tracking FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view academy clicks" ON academy_click_tracking;
CREATE POLICY "Admins can view academy clicks"
ON academy_click_tracking FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE INDEX IF NOT EXISTS idx_academy_clicks_professor ON academy_click_tracking(professor_id, created_at);
/*
  # Ajout des catégories de vidéos

  ## Modifications
  
  1. Modifications de la table `videos`
     - Ajout de la colonne `category` (enum) pour définir le type de vidéo :
       * 'teaser' - Extrait court accessible à tous
       * 'free' - Vidéo gratuite accessible à tous
       * 'platform_module' - Vidéo accessible avec abonnement plateforme
       * 'program' - Vidéo appartenant à un programme
       * 'single' - Vidéo à l'unité (achat individuel)
     - Ajout de la colonne `program_id` (référence optionnelle vers programs)
     - Ajout de la colonne `price` pour les vidéos à l'unité
     - Suppression logique de `is_free` (devient obsolète)
  
  2. Modifications de la table `programs`
     - Ajout de `content_type` pour distinguer :
       * 'free' - Programme gratuit
       * 'paid' - Programme payant
       * 'subscription_only' - Programme exclusif abonnés professeur
  
  ## Notes importantes
  
  - Les teasers sont toujours accessibles à tous
  - Les vidéos gratuites sont accessibles à tous
  - Les vidéos de modules plateforme nécessitent un abonnement plateforme
  - Les vidéos de programmes dépendent du type de programme (gratuit/payant/abonnement)
  - Les vidéos à l'unité peuvent être achetées individuellement
*/

-- Créer les types enum pour les catégories
DO $$ BEGIN
  CREATE TYPE video_category AS ENUM ('teaser', 'free', 'platform_module', 'program', 'single');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE program_content_type AS ENUM ('free', 'paid', 'subscription_only');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Ajouter les nouvelles colonnes à la table videos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'category'
  ) THEN
    ALTER TABLE videos ADD COLUMN category video_category DEFAULT 'free';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'program_id'
  ) THEN
    ALTER TABLE videos ADD COLUMN program_id uuid REFERENCES programs(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'price'
  ) THEN
    ALTER TABLE videos ADD COLUMN price decimal(10,2) DEFAULT 0;
  END IF;
END $$;

-- Ajouter content_type à la table programs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'programs' AND column_name = 'content_type'
  ) THEN
    ALTER TABLE programs ADD COLUMN content_type program_content_type DEFAULT 'free';
  END IF;
END $$;

-- Mettre à jour les vidéos existantes selon leur statut is_free
UPDATE videos 
SET category = CASE 
  WHEN is_free = true THEN 'free'::video_category
  ELSE 'platform_module'::video_category
END
WHERE category IS NULL OR category = 'free'::video_category;

-- Mettre à jour les programmes existants
UPDATE programs
SET content_type = CASE 
  WHEN price = 0 THEN 'free'::program_content_type
  ELSE 'paid'::program_content_type
END
WHERE content_type IS NULL OR content_type = 'free'::program_content_type;

-- Créer un index sur category pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category);
CREATE INDEX IF NOT EXISTS idx_videos_program_id ON videos(program_id);
CREATE INDEX IF NOT EXISTS idx_programs_content_type ON programs(content_type);

-- Créer la table pour les achats de vidéos individuelles
CREATE TABLE IF NOT EXISTS video_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  video_id uuid REFERENCES videos(id) ON DELETE CASCADE NOT NULL,
  amount_paid decimal(10,2) NOT NULL,
  purchased_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, video_id)
);

ALTER TABLE video_purchases ENABLE ROW LEVEL SECURITY;

-- Politique : Les utilisateurs peuvent voir leurs propres achats
CREATE POLICY "Users can view own video purchases"
  ON video_purchases FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Politique : Seuls les admins peuvent créer des achats (via système de paiement)
CREATE POLICY "Only admins can create video purchases"
  ON video_purchases FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Index pour les achats
CREATE INDEX IF NOT EXISTS idx_video_purchases_user_id ON video_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_video_purchases_video_id ON video_purchases(video_id);
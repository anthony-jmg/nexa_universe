/*
  # Permettre l'accès aux programmes et vidéos payants

  ## Modifications
  
  ### Programmes
  - Les programmes avec `visibility = 'paid'` sont désormais visibles par tous les utilisateurs authentifiés
  - Cela permet à n'importe qui d'acheter un programme sans avoir besoin d'abonnement
  
  ### Vidéos
  - Les vidéos avec `visibility = 'paid'` sont visibles par tous pour consultation
  - Les vidéos avec `category = 'single'` sont également accessibles pour achat à l'unité
  
  ## Notes importantes
  - Les contenus payants peuvent être achetés sans abonnement plateforme ou professeur
  - L'achat donne un accès permanent au contenu
*/

-- Mettre à jour la politique des programmes pour inclure la visibilité 'paid'
DROP POLICY IF EXISTS "Users can view accessible programs" ON programs;
CREATE POLICY "Users can view accessible programs"
  ON programs FOR SELECT
  TO authenticated
  USING (
    -- Programmes publics
    visibility = 'public'
    OR
    -- Programmes payants (visibles par tous pour achat)
    visibility = 'paid'
    OR
    -- Programmes achetés par l'utilisateur
    EXISTS (
      SELECT 1 FROM program_purchases
      WHERE program_purchases.program_id = programs.id
      AND program_purchases.user_id = auth.uid()
      AND program_purchases.status = 'active'
      AND (program_purchases.expires_at IS NULL OR program_purchases.expires_at > now())
    )
    OR
    -- Programmes réservés aux abonnés du professeur
    (visibility = 'subscribers_only' AND EXISTS (
      SELECT 1 FROM professor_subscriptions
      WHERE professor_subscriptions.user_id = auth.uid()
      AND professor_subscriptions.professor_id = programs.professor_id
      AND professor_subscriptions.status = 'active'
      AND professor_subscriptions.expires_at > now()
    ))
    OR
    -- Propriétaire (professeur) ou admin
    professor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Mettre à jour la politique des vidéos pour inclure la visibilité 'paid'
DROP POLICY IF EXISTS "Users can view accessible videos" ON videos;
CREATE POLICY "Users can view accessible videos"
  ON videos FOR SELECT
  TO authenticated
  USING (
    -- Vidéos publiques ou dans des programmes publics
    (visibility = 'public' AND (program_id IS NULL OR EXISTS (
      SELECT 1 FROM programs
      WHERE programs.id = videos.program_id
      AND programs.visibility = 'public'
    )))
    OR 
    -- Vidéos gratuites
    is_free = true
    OR
    -- Vidéos payantes à l'unité (visibles par tous pour achat)
    (visibility = 'paid' AND program_id IS NULL)
    OR
    -- Vidéos dans des programmes payants (visibles par tous)
    (program_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM programs
      WHERE programs.id = videos.program_id
      AND programs.visibility = 'paid'
    ))
    OR
    -- Vidéos dans des programmes achetés
    (program_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM program_purchases
      WHERE program_purchases.program_id = videos.program_id
      AND program_purchases.user_id = auth.uid()
      AND program_purchases.status = 'active'
      AND (program_purchases.expires_at IS NULL OR program_purchases.expires_at > now())
    ))
    OR
    -- Vidéos achetées individuellement
    EXISTS (
      SELECT 1 FROM video_purchases
      WHERE video_purchases.video_id = videos.id
      AND video_purchases.user_id = auth.uid()
      AND video_purchases.status = 'active'
    )
    OR
    -- Vidéos réservées aux abonnés du professeur
    (visibility = 'subscribers_only' AND EXISTS (
      SELECT 1 FROM professor_subscriptions
      WHERE professor_subscriptions.user_id = auth.uid()
      AND professor_subscriptions.professor_id = videos.professor_id
      AND professor_subscriptions.status = 'active'
      AND professor_subscriptions.expires_at > now()
    ))
    OR
    -- Vidéos dans des programmes réservés aux abonnés
    (program_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM programs
      WHERE programs.id = videos.program_id
      AND programs.visibility = 'subscribers_only'
      AND EXISTS (
        SELECT 1 FROM professor_subscriptions
        WHERE professor_subscriptions.user_id = auth.uid()
        AND professor_subscriptions.professor_id = programs.professor_id
        AND professor_subscriptions.status = 'active'
        AND professor_subscriptions.expires_at > now()
      )
    ))
    OR
    -- Abonnés plateforme peuvent voir tout
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.platform_subscription_status = 'active'
      AND profiles.platform_subscription_expires_at > now()
    )
    OR
    -- Propriétaire (professeur) ou admin
    professor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
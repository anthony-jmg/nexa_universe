/*
# Remove Nexa Access (platform subscription) from RLS policies

1. Purpose
- Nexa Access (l'abonnement plateforme) est supprimé du projet.
- Les policies RLS ci-dessous référençaient encore `profiles.platform_subscription_status`
  pour accorder l'accès à des contenus. Ces clauses sont retirées.
- Aucune colonne ni donnée n'est supprimée : les colonnes `platform_subscription_*`
  restent en place tant qu'un abonné existant est actif (décision utilisateur en attente).

2. Modified policies
- `programs` : "Platform subscribers can view platform programs" supprimée
  (aucune ligne n'utilise visibility='platform').
- `programs` : "Anon can discover programs" recréée sans 'platform' dans la liste
  des visibilités découvrables.
- `videos` : "Anon can discover videos" recréée sans 'platform'.
- `videos` : "Users can view accessible videos" recréée sans la clause
  "abonné plateforme actif => accès à tout".
- `program_videos` : "Users can view program videos" recréée sans la clause
  "abonné plateforme actif => accès à tout".

3. Security
- Les abonnements professeurs (subscribers_only), les achats à la carte
  (program_purchases / video_purchases) et le rôle admin restent inchangés.
- Aucun contenu 'platform' n'existe en base (0 ligne), donc aucun accès n'est perdu.

4. Notes
- Migration idempotente (DROP POLICY IF EXISTS puis CREATE).
*/

DROP POLICY IF EXISTS "Platform subscribers can view platform programs" ON programs;

DROP POLICY IF EXISTS "Anon can discover programs" ON programs;
CREATE POLICY "Anon can discover programs"
ON programs FOR SELECT
TO anon
USING (
  (is_active = true) AND (
    (visibility = ANY (ARRAY['public'::text, 'paid'::text])) OR
    ((visibility = 'subscribers_only'::text) AND (
      EXISTS (
        SELECT 1 FROM professors
        WHERE professors.id = programs.professor_id
          AND professors.subscription_price = 0
      )
    ))
  )
);

DROP POLICY IF EXISTS "Anon can discover videos" ON videos;
CREATE POLICY "Anon can discover videos"
ON videos FOR SELECT
TO anon
USING (
  (visibility = 'public'::text) OR
  ((visibility = 'subscribers_only'::text) AND (
    EXISTS (
      SELECT 1 FROM professors
      WHERE professors.id = videos.professor_id
        AND professors.subscription_price = 0
    )
  ))
);

DROP POLICY IF EXISTS "Users can view accessible videos" ON videos;
CREATE POLICY "Users can view accessible videos"
ON videos FOR SELECT
TO authenticated
USING (
  ((visibility = 'public'::text) AND ((program_id IS NULL) OR (
    EXISTS (
      SELECT 1 FROM programs
      WHERE programs.id = videos.program_id
        AND programs.visibility = 'public'::text
    )
  )))
  OR ((visibility = 'paid'::text) AND (program_id IS NULL))
  OR ((program_id IS NOT NULL) AND (
    EXISTS (
      SELECT 1 FROM programs
      WHERE programs.id = videos.program_id
        AND programs.visibility = 'paid'::text
    )
  ))
  OR ((program_id IS NOT NULL) AND (
    EXISTS (
      SELECT 1 FROM program_purchases
      WHERE program_purchases.program_id = videos.program_id
        AND program_purchases.user_id = auth.uid()
        AND program_purchases.status = 'active'::text
        AND ((program_purchases.expires_at IS NULL) OR (program_purchases.expires_at > now()))
    )
  ))
  OR (
    EXISTS (
      SELECT 1 FROM video_purchases
      WHERE video_purchases.video_id = videos.id
        AND video_purchases.user_id = auth.uid()
        AND video_purchases.status = 'active'::text
    )
  )
  OR ((visibility = 'subscribers_only'::text) AND (
    EXISTS (
      SELECT 1 FROM professor_subscriptions
      WHERE professor_subscriptions.user_id = auth.uid()
        AND professor_subscriptions.professor_id = videos.professor_id
        AND professor_subscriptions.status = 'active'::text
        AND professor_subscriptions.expires_at > now()
    )
  ))
  OR ((program_id IS NOT NULL) AND (
    EXISTS (
      SELECT 1 FROM programs
      WHERE programs.id = videos.program_id
        AND programs.visibility = 'subscribers_only'::text
        AND (
          EXISTS (
            SELECT 1 FROM professor_subscriptions
            WHERE professor_subscriptions.user_id = auth.uid()
              AND professor_subscriptions.professor_id = programs.professor_id
              AND professor_subscriptions.status = 'active'::text
              AND professor_subscriptions.expires_at > now()
          )
        )
    )
  ))
  OR (professor_id = auth.uid())
  OR (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'::text
    )
  )
);

DROP POLICY IF EXISTS "Users can view program videos" ON program_videos;
CREATE POLICY "Users can view program videos"
ON program_videos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM programs
    WHERE programs.id = program_videos.program_id
      AND (
        (programs.visibility = 'public'::text)
        OR (programs.professor_id = auth.uid())
        OR (
          EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'::text
          )
        )
      )
  )
);

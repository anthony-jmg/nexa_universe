-- Livraison manuelle des billets officiels (lot P0).
-- 1. Fichier officiel ajouté uniquement sur un billet intégralement payé, non
--    annulé, d'un événement non annulé, et seulement si le fichier existe
--    réellement dans le stockage (un import échoué ne peut jamais afficher le
--    billet comme délivré).
-- 2. Lien de téléchargement réservé au propriétaire d'un billet délivré et
--    valide : annulé, remboursé ou événement annulé → aucun lien.
-- 3. Bucket limité aux PDF de 10 Mo.
-- 4. Notification « billet disponible » : renvoie à « Mes Pass ».
-- Aucune donnée existante modifiée.

-- 1. Ajout du fichier officiel -------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_pass_columns_admin_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_is_admin boolean;
BEGIN
IF NEW.pass_status IS DISTINCT FROM OLD.pass_status
OR NEW.pass_file_path IS DISTINCT FROM OLD.pass_file_path
OR NEW.pass_uploaded_at IS DISTINCT FROM OLD.pass_uploaded_at
OR NEW.pass_reference IS DISTINCT FROM OLD.pass_reference THEN
SELECT (role = 'admin') INTO v_is_admin FROM profiles WHERE id = auth.uid();
IF NOT COALESCE(v_is_admin, false) THEN
RAISE EXCEPTION 'Seul un administrateur peut modifier le pass.';
END IF;
-- Billet délivré : achat intégralement payé et toujours valide.
IF NEW.pass_status = 'available' THEN
IF NEW.check_in_status IS DISTINCT FROM 'not_checked_in' THEN
RAISE EXCEPTION 'Billet non éligible : achat non intégralement payé ou annulé (statut : %)', NEW.check_in_status;
END IF;
IF EXISTS (SELECT 1 FROM events e WHERE e.id = NEW.event_id AND e.event_status = 'cancelled') THEN
RAISE EXCEPTION 'Billet non éligible : événement annulé';
END IF;
-- Fichier rangé au nom de ce participant, et réellement présent.
IF NEW.pass_file_path IS NULL
OR left(NEW.pass_file_path, length(NEW.user_id::text || '/' || NEW.id::text || '/'))
<> NEW.user_id::text || '/' || NEW.id::text || '/' THEN
RAISE EXCEPTION 'Fichier du billet invalide';
END IF;
IF NOT EXISTS (
SELECT 1 FROM storage.objects o
WHERE o.bucket_id = 'event-passes' AND o.name = NEW.pass_file_path
) THEN
RAISE EXCEPTION 'Fichier du billet introuvable dans le stockage';
END IF;
END IF;
END IF;
RETURN NEW;
END $function$;

-- 2. Téléchargement par le festivalier ---------------------------------------
-- Vérifié à chaque création de lien signé (lecture storage.objects).
CREATE OR REPLACE FUNCTION public.can_download_event_pass(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM event_attendees a
      JOIN events e ON e.id = a.event_id
     WHERE a.pass_file_path = p_name
       AND a.user_id = auth.uid()
       AND a.pass_status = 'available'
       AND a.check_in_status = 'not_checked_in'
       AND e.event_status IS DISTINCT FROM 'cancelled'
  );
$function$;

REVOKE ALL ON FUNCTION public.can_download_event_pass(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_download_event_pass(text) TO authenticated;

DROP POLICY "Users read own event passes" ON storage.objects;

CREATE POLICY "Users read own event passes"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'event-passes' AND public.can_download_event_pass(name));

-- 3. Fichiers acceptés ------------------------------------------------------
UPDATE storage.buckets
   SET file_size_limit = 10485760,
       allowed_mime_types = ARRAY['application/pdf']
 WHERE id = 'event-passes';

-- 4. Notification « billet disponible » -------------------------------------
-- Ancien texte : « Retrouve-le dans « Mes achats » » (page renommée Mes Pass).
-- Les notifications déjà envoyées ne sont pas modifiées.
CREATE OR REPLACE FUNCTION public.notify_pass_available()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
IF NEW.pass_status = 'available' AND OLD.pass_status IS DISTINCT FROM 'available' THEN
INSERT INTO notifications (user_id, type, title, message, item_id)
VALUES (
NEW.user_id,
'pass_available',
'Ton billet officiel est disponible',
'Ton billet officiel est disponible. Télécharge-le dans « Mes Pass ».',
NEW.id
);
END IF;
RETURN NEW;
END $function$;

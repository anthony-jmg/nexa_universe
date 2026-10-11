/*
# Price Lock : attache définitive au type de billet (multi-types par événement)

1. Contexte
- Un événement peut proposer plusieurs types de billets (Full Pass Homme,
  Full Pass Femme, Pass Weekend...), chacun avec son propre prix, sa propre
  hausse, son propre quota et son propre Price Lock.
- Le backend applique déjà toutes les règles par type de billet : le trigger
  de création photographie le prix du type choisi, le quota est compté par
  type, la limite utilisateur est par festival, le verrou par palier tarifaire
  est par type.

2. Changement
- Le trigger `protect_price_lock_terms` (immutabilité des termes d'un lock
  actif) ne protégeait pas le rattachement au type de billet : un lock actif
  pouvait être mis à jour pour pointer vers un autre `event_ticket_types`
  (ex. Full Pass Homme -> Full Pass Femme), ce qui fausserait l'expiration
  (solde recalculé sur le mauvais prix public) et contournerait l'interdiction
  de transfert automatique.
- Désormais, tant que le lock est actif, `event_ticket_type_id` et `event_id`
  sont immuables. Un changement de type de billet impose d'abord d'annuler le
  lock, puis de créer un nouveau lock selon les règles en vigueur.

3. Tables modifiées
- `price_locks` : aucun changement de structure, aucune donnée touchée.
  Fonction de trigger `protect_price_lock_terms` réécrite uniquement.

4. Sécurité
- Aucun changement RLS. La fonction reste SECURITY DEFINER avec search_path
  épinglé, déclenchée sur la table existante.
*/

CREATE OR REPLACE FUNCTION public.protect_price_lock_terms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
IF OLD.status = 'active' AND (
NEW.locked_price <> OLD.locked_price
OR NEW.deposit_amount <> OLD.deposit_amount
OR NEW.locked_at <> OLD.locked_at
OR NEW.expires_at <> OLD.expires_at
OR NEW.event_ticket_type_id IS DISTINCT FROM OLD.event_ticket_type_id
OR NEW.event_id IS DISTINCT FROM OLD.event_id
) THEN
RAISE EXCEPTION 'Les termes d''un Price Lock actif ne peuvent pas être modifiés';
END IF;
NEW.updated_at := now();
RETURN NEW;
END $function$;

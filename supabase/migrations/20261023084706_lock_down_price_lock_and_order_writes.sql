/*
# Sécurité : fermeture des écritures directes Price Lock / commandes / billets

1. Problème
- `price_locks` : les politiques RLS permettaient à l'utilisateur d'insérer,
  modifier et supprimer ses propres locks. La migration
  `20261010111000_price_locks_bind_tiers` avait en plus remplacé
  `protect_price_lock_terms()` par une version qui ne protégeait plus que
  `price_tier_id` : un utilisateur pouvait donc passer son lock en
  `completed` (ou baisser `locked_price`) sans payer.
- Plusieurs fonctions SECURITY DEFINER réservées au backend restaient
  exécutables par `authenticated` (`record_price_lock_payment`,
  `complete_price_lock_attendees`, `convert_pending_to_actual_attendees`,
  `claim_price_lock_auto_debit`, `finalize_price_lock_auto_debit`, ...),
  sans contrôle du propriétaire ni preuve de paiement.
- `event_attendees` : l'utilisateur pouvait modifier n'importe quelle colonne
  de ses billets (statut de solde, `status` après check-in, ...).
- `orders` / `order_items` / `pending_event_attendees` : l'utilisateur pouvait
  créer ses propres commandes, lignes et participants, et changer librement le
  statut d'une commande `pending` (ex. `paid`).
- `check_in_attendee` acceptait un billet dont le solde Price Lock n'est pas
  réglé (`check_in_status = 'awaiting_balance'`).

2. Correctif
- Suppression des politiques d'écriture utilisateur sur `price_locks` +
  trigger de garde qui refuse toute écriture directe des rôles `anon` /
  `authenticated` (les fonctions SECURITY DEFINER et le service role restent
  autorisés).
- `protect_price_lock_terms()` rétablie : les termes d'un lock (prix bloqué,
  versement, dates, billet, palier, utilisateur) sont immuables.
- EXECUTE retiré à PUBLIC / anon / authenticated sur les fonctions backend,
  accordé au seul `service_role`.
- `event_attendees` : un client (non admin) ne peut plus créer de billet ; en
  modification il ne peut changer que les coordonnées du participant, ou
  annuler un billet `not_checked_in`.
- `orders` : un client (non admin) ne peut plus créer de commande ; en
  modification il ne peut que passer une commande `pending` en `cancelled`.
- `order_items` / `pending_event_attendees` : aucune écriture client (non admin).
- Check-in refusé tant que le solde Price Lock n'est pas réglé.

3. Compatibilité
- Les edge functions utilisent le service role : non concernées.
- Le front n'écrit jamais dans `price_locks` et n'appelle aucune des fonctions
  révoquées. Les écritures client restantes (annulation de commande, annulation
  de billet, coordonnées des participants, actions admin) restent permises.
*/

-- ═══ 0. Helpers ═══

-- Vrai quand la requête vient directement d'un client PostgREST.
-- SECURITY INVOKER volontairement : à l'intérieur d'une fonction SECURITY
-- DEFINER, current_user est le propriétaire et l'écriture est autorisée.
CREATE OR REPLACE FUNCTION public.nexa_is_client_role()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT current_user IN ('anon', 'authenticated');
$$;

CREATE OR REPLACE FUNCTION public.nexa_caller_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.nexa_caller_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nexa_caller_is_admin() TO authenticated, service_role;

-- ═══ 1. price_locks : plus aucune écriture directe côté client ═══

DROP POLICY IF EXISTS "Users can create own price locks" ON price_locks;
DROP POLICY IF EXISTS "Users can update own price locks" ON price_locks;
DROP POLICY IF EXISTS "Users can delete own price locks" ON price_locks;

CREATE OR REPLACE FUNCTION public.guard_price_locks_client_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF nexa_is_client_role() THEN
    RAISE EXCEPTION 'Les Price Locks ne peuvent être modifiés que par le serveur';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_price_locks_guard_client_writes ON price_locks;
CREATE TRIGGER trg_price_locks_guard_client_writes
  BEFORE INSERT OR UPDATE OR DELETE ON price_locks
  FOR EACH ROW EXECUTE FUNCTION guard_price_locks_client_writes();

-- Termes figés d'un lock : jamais modifiables, quel que soit l'appelant.
CREATE OR REPLACE FUNCTION public.protect_price_lock_terms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.event_ticket_type_id IS DISTINCT FROM OLD.event_ticket_type_id
     OR NEW.price_tier_id IS DISTINCT FROM OLD.price_tier_id
     OR NEW.locked_price IS DISTINCT FROM OLD.locked_price
     OR NEW.deposit_amount IS DISTINCT FROM OLD.deposit_amount
     OR NEW.locked_at IS DISTINCT FROM OLD.locked_at
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.price_increase_date IS DISTINCT FROM OLD.price_increase_date THEN
    RAISE EXCEPTION 'Les termes d''un Price Lock ne peuvent pas être modifiés';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- Un seul trigger de protection (les deux existants appelaient la même fonction)
DROP TRIGGER IF EXISTS trg_price_locks_protect_tier ON price_locks;
DROP TRIGGER IF EXISTS trg_price_locks_protect_terms ON price_locks;
CREATE TRIGGER trg_price_locks_protect_terms
  BEFORE UPDATE ON price_locks
  FOR EACH ROW EXECUTE FUNCTION protect_price_lock_terms();

-- ═══ 2. Fonctions backend : service role uniquement ═══

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
         'record_price_lock_payment',
         'complete_price_lock_attendees',
         'convert_pending_to_actual_attendees',
         'claim_price_lock_auto_debit',
         'finalize_price_lock_auto_debit',
         'create_stripe_price_lock_deposit',
         'expire_stale_price_locks'
       )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;

-- ═══ 3. event_attendees : coordonnées et annulation uniquement ═══

CREATE OR REPLACE FUNCTION public.guard_event_attendees_client_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  editable text[] := ARRAY[
    'attendee_first_name', 'attendee_last_name', 'attendee_email',
    'attendee_phone', 'check_in_status', 'updated_at'
  ];
BEGIN
  IF NOT nexa_is_client_role() OR nexa_caller_is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Les billets sont créés uniquement après paiement confirmé';
  END IF;

  IF (to_jsonb(NEW) - editable) IS DISTINCT FROM (to_jsonb(OLD) - editable) THEN
    RAISE EXCEPTION 'Modification non autorisée de ce billet';
  END IF;

  IF NEW.check_in_status IS DISTINCT FROM OLD.check_in_status
     AND NOT (OLD.check_in_status = 'not_checked_in' AND NEW.check_in_status = 'cancelled') THEN
    RAISE EXCEPTION 'Changement de statut du billet non autorisé';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_event_attendees_guard_client_writes ON event_attendees;
CREATE TRIGGER trg_event_attendees_guard_client_writes
  BEFORE INSERT OR UPDATE ON event_attendees
  FOR EACH ROW EXECUTE FUNCTION guard_event_attendees_client_writes();

-- Pas d'entrée tant que le solde Price Lock n'est pas réglé : un billet
-- 'awaiting_balance' ne peut passer qu'à 'not_checked_in' (solde payé, via
-- complete_price_lock_attendees) ou 'cancelled'.
CREATE OR REPLACE FUNCTION public.block_check_in_awaiting_balance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.check_in_status = 'awaiting_balance'
     AND NEW.check_in_status = 'checked_in' THEN
    RAISE EXCEPTION 'Solde Price Lock non réglé : entrée refusée';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_event_attendees_block_awaiting_balance ON event_attendees;
CREATE TRIGGER trg_event_attendees_block_awaiting_balance
  BEFORE UPDATE ON event_attendees
  FOR EACH ROW EXECUTE FUNCTION block_check_in_awaiting_balance();

-- ═══ 4. orders : création serveur, annulation seule côté client ═══

CREATE OR REPLACE FUNCTION public.guard_orders_client_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT nexa_is_client_role() OR nexa_caller_is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Les commandes sont créées uniquement par le serveur';
  END IF;

  IF NOT (OLD.status = 'pending' AND NEW.status = 'cancelled')
     OR (to_jsonb(NEW) - ARRAY['status', 'updated_at'])
        IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'updated_at']) THEN
    RAISE EXCEPTION 'Seule l''annulation d''une commande en attente est autorisée';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_orders_guard_client_writes ON orders;
CREATE TRIGGER trg_orders_guard_client_writes
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION guard_orders_client_writes();

-- ═══ 5. order_items / pending_event_attendees : écriture serveur uniquement ═══

CREATE OR REPLACE FUNCTION public.guard_server_only_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF nexa_is_client_role() AND NOT nexa_caller_is_admin() THEN
    RAISE EXCEPTION 'Écriture réservée au serveur (%)', TG_TABLE_NAME;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_order_items_guard_client_writes ON order_items;
CREATE TRIGGER trg_order_items_guard_client_writes
  BEFORE INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION guard_server_only_writes();

DROP TRIGGER IF EXISTS trg_pending_event_attendees_guard_client_writes ON pending_event_attendees;
CREATE TRIGGER trg_pending_event_attendees_guard_client_writes
  BEFORE INSERT OR UPDATE ON pending_event_attendees
  FOR EACH ROW EXECUTE FUNCTION guard_server_only_writes();

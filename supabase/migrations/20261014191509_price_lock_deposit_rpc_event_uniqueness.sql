/*
# Price Lock : alignement de la règle d'unicité dans la validation checkout

1. Objet
- La règle métier validée est : UN SEUL Price Lock ACTIF par UTILISATEUR et par ÉVÉNEMENT
  (tous types de billets confondus), et maximum 2 Price Locks actifs au total par utilisateur
  sur deux événements différents.
- Le trigger `enforce_price_lock_rules` (source de vérité) et `validate-and-create-order`
  appliquent déjà cette règle au niveau événement.
- La fonction `create_stripe_price_lock_deposit` (utilisée par create-stripe-checkout et
  validate-and-create-order) ne vérifiait que le niveau billet : un utilisateur avec un lock
  actif sur "Full Pass Homme" pouvait lancer un paiement Price Lock sur "Full Pass Femme"
  du même festival. La création du lock aurait ensuite échoué côté trigger, après encaissement.

2. Changement
- Ajout dans `create_stripe_price_lock_deposit` d'un contrôle au niveau ÉVÉNEMENT :
  si l'utilisateur possède déjà un Price Lock actif sur n'importe quel billet du même
  événement, la validation échoue avec le même message que le trigger.
- Aucune règle concurrente ajoutée : on aligne simplement cette fonction sur la règle
  existante du trigger. Aucune donnée existante n'est modifiée.

3. Sécurité
- Fonction SECURITY DEFINER inchangée dans son rôle ; contrôle renforcé côté serveur.
*/

CREATE OR REPLACE FUNCTION create_stripe_price_lock_deposit(p_user_id uuid, p_ticket_type_id uuid, p_amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ett record;
  v_pricing record;
  v_min_deposit numeric;
  v_event_is_test boolean;
  v_active_locks integer;
  v_locks_for_type integer;
  v_unit_price numeric;
  v_amount numeric;
BEGIN
  IF p_amount IS NULL OR NOT isfinite(p_amount) OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montant de versement invalide';
  END IF;
  v_amount := round(p_amount::numeric, 2);

  SELECT * INTO ett FROM event_ticket_types
  WHERE id = p_ticket_type_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Billet introuvable pour le Price Lock.';
  END IF;
  IF NOT ett.price_lock_enabled THEN
    RAISE EXCEPTION 'Price Lock non disponible pour ce billet.';
  END IF;
  IF ett.price_increase_date IS NULL THEN
    RAISE EXCEPTION 'Aucune hausse tarifaire programmée pour ce billet.';
  END IF;

  SELECT current_price INTO v_pricing
  FROM get_event_ticket_pricing(p_ticket_type_id);
  IF v_pricing IS NULL OR v_pricing.current_price IS NULL THEN
    RAISE EXCEPTION 'Aucun tarif actif pour ce billet. Contacte le support.';
  END IF;
  v_unit_price := v_pricing.current_price;

  -- Fenêtre Price Lock (mêmes règles que le trigger)
  IF now() < COALESCE(ett.price_lock_opens_at, ett.price_increase_date - interval '10 day')
  OR now() >= ett.price_increase_date THEN
    RAISE EXCEPTION 'Price Lock fermé pour ce billet.';
  END IF;

  -- UN SEUL Price Lock actif par utilisateur et par ÉVÉNEMENT, tous billets confondus
  SELECT count(*) INTO v_active_locks FROM price_locks
  WHERE user_id = p_user_id AND event_id = ett.event_id AND status = 'active';
  IF v_active_locks > 0 THEN
    RAISE EXCEPTION 'Un seul Price Lock actif par festival et par utilisateur.';
  END IF;

  -- Max 2 Price Locks actifs simultanément par utilisateur (deux événements différents)
  SELECT count(*) INTO v_active_locks FROM price_locks
  WHERE user_id = p_user_id AND status = 'active';
  IF v_active_locks >= 2 THEN
    RAISE EXCEPTION 'Maximum 2 Price Locks actifs simultanément.';
  END IF;

  -- Quota
  IF ett.quantity_available IS NOT NULL THEN
    SELECT count(*) INTO v_locks_for_type FROM price_locks
    WHERE event_ticket_type_id = p_ticket_type_id AND status = 'active';
    IF ett.quantity_sold + v_locks_for_type >= ett.quantity_available THEN
      RAISE EXCEPTION 'Quota Price Lock épuisé pour ce billet.';
    END IF;
  END IF;

  -- Montant choisi : minimum autorisé et strictement inférieur au prix bloqué
  IF v_amount >= v_unit_price THEN
    RAISE EXCEPTION 'Pour payer la totalité du pass, utilise Acheter maintenant.';
  END IF;

  SELECT e.is_test INTO v_event_is_test FROM events e WHERE e.id = ett.event_id;

  IF v_event_is_test THEN
    v_min_deposit := ett.price_lock_deposit_amount;
  ELSE
    v_min_deposit := GREATEST(ett.price_lock_deposit_amount, 20);
  END IF;

  IF v_amount < v_min_deposit THEN
    RAISE EXCEPTION 'Le versement minimum pour ce Price Lock est de % €.', v_min_deposit;
  END IF;

  RETURN v_amount;
END
$$;
/*
# Backfill des paliers tarifaires depuis les données legacy

1. Pour chaque `event_ticket_types` existant (8 lignes) sans palier :
   - palier "actuel" : label "Palier actuel", prix = price legacy, starts_at =
     sale_start_date si renseignée, sinon la plus ancienne date déductible
     (création du billet) ; ends_at = price_increase_date si une hausse existe.
   - palier "suivant" : créé uniquement si next_price ET price_increase_date
     existent (2 lignes du festival [TEST]), starts_at = price_increase_date.
2. Les Price Locks actifs existants sont rattachés au palier correspondant à
   leur locked_price (price_tier_id), sans toucher à leurs montants figés.
3. Aucune donnée historique n'est modifiée ou supprimée ; seules des lignes
   `event_ticket_price_tiers` sont ajoutées.

Cas signalés (dates non déductibles proprement) :
- Les billets "M.A.D Kizomba FLOW" et "MAD NIGHT 3" n'ont ni sale_start_date
  ni hausse programmée : le palier actuel démarre à created_at (fallback),
  à confirmer par l'admin si une date commerciale exacte est souhaitée.
- Le billet à 0,50 € de "MAD NIGHT 3" est visiblement un prix de test.
*/

-- Palier actuel pour chaque billet sans palier
INSERT INTO event_ticket_price_tiers (event_ticket_type_id, label, price, starts_at, ends_at, display_order)
SELECT ett.id,
       'Palier actuel',
       ett.price,
       COALESCE(ett.sale_start_date, ett.created_at, now()),
       ett.price_increase_date,
       0
  FROM event_ticket_types ett
 WHERE NOT EXISTS (
   SELECT 1 FROM event_ticket_price_tiers t
    WHERE t.event_ticket_type_id = ett.id
 );

-- Palier suivant pour les billets avec une hausse programmée
INSERT INTO event_ticket_price_tiers (event_ticket_type_id, label, price, starts_at, display_order)
SELECT ett.id,
       'Palier suivant',
       ett.next_price,
       ett.price_increase_date,
       1
  FROM event_ticket_types ett
 WHERE ett.next_price IS NOT NULL
   AND ett.price_increase_date IS NOT NULL
   AND NOT EXISTS (
   SELECT 1 FROM event_ticket_price_tiers t
    WHERE t.event_ticket_type_id = ett.id
      AND t.starts_at = ett.price_increase_date
 );

-- Rattachement des Price Locks existants au palier de leur prix bloqué
UPDATE price_locks pl
   SET price_tier_id = t.id
  FROM event_ticket_price_tiers t
 WHERE t.event_ticket_type_id = pl.event_ticket_type_id
   AND t.price = pl.locked_price
   AND pl.price_tier_id IS NULL;

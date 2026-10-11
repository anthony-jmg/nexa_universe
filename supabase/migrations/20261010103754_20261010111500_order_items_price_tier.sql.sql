/*
# Traçabilité des paliers dans les lignes de commande

1. Ajout de `order_items.price_tier_id` (uuid nullable, référence
   event_ticket_price_tiers) : chaque ligne de commande enregistre le palier
   dont le prix a été facturé, pour audit et support, sans modifier les
   colonnes existantes ni les données historiques.
2. Aucune donnée modifiée ; les anciennes lignes gardent price_tier_id NULL.
*/

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS price_tier_id uuid
  REFERENCES event_ticket_price_tiers(id);

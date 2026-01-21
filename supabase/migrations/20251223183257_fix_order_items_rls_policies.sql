/*
  # Correction des politiques RLS pour order_items

  1. Problème identifié
    - Les utilisateurs ne peuvent pas créer d'order_items lors de l'achat de billets
    - La table order_items manque de politiques RLS pour INSERT
    - Cela empêche l'affichage des commandes dans la page "Mes Achats"

  2. Solution
    - Ajouter une politique SELECT pour permettre aux utilisateurs de voir leurs propres order_items
    - Ajouter une politique INSERT pour permettre la création d'order_items via le système d'achat

  3. Sécurité
    - Les utilisateurs ne peuvent voir que les order_items de leurs propres commandes
    - Les utilisateurs ne peuvent créer des order_items que pour leurs propres commandes
*/

-- Vérifier si RLS est activé, sinon l'activer
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "Users can view own order items" ON order_items;
DROP POLICY IF EXISTS "Users can insert own order items" ON order_items;

-- Politique SELECT: Les utilisateurs peuvent voir les order_items de leurs propres commandes
CREATE POLICY "Users can view own order items"
  ON order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Politique INSERT: Les utilisateurs peuvent créer des order_items pour leurs propres commandes
CREATE POLICY "Users can insert own order items"
  ON order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

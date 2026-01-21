/*
  # Système de panier sécurisé

  1. Nouvelle table
    - `cart_items` - Articles du panier par utilisateur
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key -> auth.users)
      - `product_id` (uuid, foreign key -> products)
      - `quantity` (integer)
      - `selected_size` (text, optional)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Sécurité (RLS)
    - Enable RLS sur cart_items
    - Politique SELECT: Les utilisateurs peuvent voir uniquement leurs propres items
    - Politique INSERT: Les utilisateurs peuvent ajouter uniquement à leur propre panier
    - Politique UPDATE: Les utilisateurs peuvent modifier uniquement leurs propres items
    - Politique DELETE: Les utilisateurs peuvent supprimer uniquement leurs propres items

  3. Indexes
    - Index sur user_id pour requêtes rapides
    - Index composite sur (user_id, product_id, selected_size) pour éviter doublons

  Notes importantes:
    - Contrainte unique pour éviter les doublons (user_id + product_id + selected_size)
    - Cascade delete si le produit est supprimé
    - Validation: quantity > 0
*/

-- Créer la table cart_items
CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  selected_size text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id, selected_size)
);

-- Créer les indexes pour performance
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_user_product ON cart_items(user_id, product_id);

-- Activer RLS
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Politique SELECT: Utilisateurs peuvent voir uniquement leurs propres items
CREATE POLICY "Users can view own cart items"
  ON cart_items
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Politique INSERT: Utilisateurs peuvent ajouter uniquement à leur propre panier
CREATE POLICY "Users can add to own cart"
  ON cart_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Politique UPDATE: Utilisateurs peuvent modifier uniquement leurs propres items
CREATE POLICY "Users can update own cart items"
  ON cart_items
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Politique DELETE: Utilisateurs peuvent supprimer uniquement leurs propres items
CREATE POLICY "Users can delete own cart items"
  ON cart_items
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_cart_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS cart_items_updated_at ON cart_items;
CREATE TRIGGER cart_items_updated_at
  BEFORE UPDATE ON cart_items
  FOR EACH ROW
  EXECUTE FUNCTION update_cart_items_updated_at();

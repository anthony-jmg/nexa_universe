/*
  # Système de suivi des paiements aux professeurs

  1. Nouvelles Tables
    - `professor_payments`
      - `id` (uuid, clé primaire)
      - `professor_id` (uuid, référence vers professors)
      - `period_start` (date de début de la période)
      - `period_end` (date de fin de la période)
      - `amount` (montant total à payer)
      - `currency` (devise, par défaut 'eur')
      - `status` (pending, paid, cancelled)
      - `paid_at` (date du virement)
      - `paid_by` (uuid, admin qui a marqué comme payé)
      - `notes` (notes sur le paiement)
      - `created_at` (timestamp de création)

    - `payment_line_items`
      - `id` (uuid, clé primaire)
      - `payment_id` (uuid, référence vers professor_payments)
      - `item_type` (video_purchase, program_purchase, subscription)
      - `item_id` (uuid, id de l'item vendu)
      - `order_item_id` (uuid, référence vers order_items si applicable)
      - `subscription_id` (uuid, référence vers subscriptions si applicable)
      - `amount` (montant de cette ligne)
      - `sale_date` (date de la vente)
      - `created_at` (timestamp)

  2. Sécurité
    - RLS activé sur toutes les tables
    - Seuls les admins peuvent voir et modifier les paiements
    - Les professeurs peuvent voir leurs propres paiements (lecture seule)

  3. Index
    - Index sur professor_id pour les requêtes rapides
    - Index sur status pour filtrer les paiements
    - Index sur period_start et period_end
*/

-- Table pour les paiements aux professeurs
CREATE TABLE IF NOT EXISTS professor_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  amount decimal(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'eur',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at timestamptz,
  paid_by uuid REFERENCES profiles(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Table pour les lignes de détail des paiements
CREATE TABLE IF NOT EXISTS payment_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES professor_payments(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('video_purchase', 'program_purchase', 'subscription')),
  item_id uuid NOT NULL,
  order_item_id uuid REFERENCES order_items(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount decimal(10,2) NOT NULL,
  sale_date timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_professor_payments_professor_id ON professor_payments(professor_id);
CREATE INDEX IF NOT EXISTS idx_professor_payments_status ON professor_payments(status);
CREATE INDEX IF NOT EXISTS idx_professor_payments_period ON professor_payments(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_payment_line_items_payment_id ON payment_line_items(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_line_items_item_type ON payment_line_items(item_type, item_id);

-- Activer RLS
ALTER TABLE professor_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_line_items ENABLE ROW LEVEL SECURITY;

-- Policies pour professor_payments

-- Les admins peuvent tout voir
CREATE POLICY "Admins can view all professor payments"
  ON professor_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Les professeurs peuvent voir leurs propres paiements
CREATE POLICY "Professors can view own payments"
  ON professor_payments FOR SELECT
  TO authenticated
  USING (professor_id = auth.uid());

-- Seuls les admins peuvent créer des paiements
CREATE POLICY "Admins can create professor payments"
  ON professor_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Seuls les admins peuvent mettre à jour les paiements
CREATE POLICY "Admins can update professor payments"
  ON professor_payments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Seuls les admins peuvent supprimer les paiements
CREATE POLICY "Admins can delete professor payments"
  ON professor_payments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policies pour payment_line_items

-- Les admins peuvent tout voir
CREATE POLICY "Admins can view all payment line items"
  ON payment_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Les professeurs peuvent voir les lignes de leurs paiements
CREATE POLICY "Professors can view own payment line items"
  ON payment_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM professor_payments
      WHERE professor_payments.id = payment_line_items.payment_id
      AND professor_payments.professor_id = auth.uid()
    )
  );

-- Seuls les admins peuvent créer des lignes de paiement
CREATE POLICY "Admins can create payment line items"
  ON payment_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Seuls les admins peuvent mettre à jour les lignes de paiement
CREATE POLICY "Admins can update payment line items"
  ON payment_line_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Seuls les admins peuvent supprimer les lignes de paiement
CREATE POLICY "Admins can delete payment line items"
  ON payment_line_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
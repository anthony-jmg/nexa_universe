# Analyse du Système de Gestion des Commandes

## 🎯 Vue d'ensemble

Ce document identifie les problèmes critiques et les opportunités d'amélioration dans le système actuel de gestion des commandes (orders/order_items).

---

## ⚠️ Problèmes Critiques Identifiés

### 1. 🔴 CRITIQUE: Manque de Migration SQL

**Problème:**
Les tables `orders` et `order_items` **existent dans la base de données** mais **n'ont PAS de fichier de migration SQL** correspondant dans `supabase/migrations/`.

**Conséquences:**
- ❌ Impossible de recréer la base de données de zéro
- ❌ Pas de documentation de la structure des tables
- ❌ Traçabilité compromise
- ❌ Déploiement impossible sur nouveaux environnements

**Preuve:**
```bash
# Recherche dans les migrations
$ grep -r "CREATE TABLE.*orders" supabase/migrations/*.sql
# Résultat: Aucun fichier trouvé

# Mais la table existe:
orders table: 12 colonnes, 8 rows, RLS activé
order_items table: 8 colonnes, 8 rows, RLS activé
```

**Impact:** 🔥 **BLOQUANT** pour le déploiement et la maintenance

---

### 2. 🔴 CRITIQUE: Validation des Prix Côté Client Uniquement

**Problème:**
Les prix sont calculés **côté client** (Cart.tsx lignes 34-44, 46-55) et envoyés directement à Stripe **sans vérification serveur**.

**Code vulnérable:**
```typescript
// Cart.tsx ligne 106-120
const { data: order, error: orderError } = await supabase
  .from('orders')
  .insert({
    user_id: user.id,
    total_amount: total,  // ← Calculé côté client ⚠️
    // ...
  })
```

**Exploitation possible:**
1. Un utilisateur ouvre DevTools
2. Modifie `total_amount` de 100€ à 1€
3. Crée la commande avec le prix modifié
4. Stripe reçoit le prix modifié

**Conséquences:**
- 💰 **Perte financière directe**
- 🔓 Violation de l'intégrité des données
- ⚖️ Problèmes légaux potentiels

**Impact:** 🔥 **CRITIQUE** - Faille de sécurité majeure

---

### 3. 🟠 MAJEUR: Commandes Orphelines (Abandoned Carts)

**Problème:**
Les commandes en statut `pending` restent **indéfiniment** en base de données si l'utilisateur abandonne le checkout Stripe.

**Flux actuel:**
```
1. Utilisateur clique "Commander"
2. Commande créée avec status='pending' ✅
3. Redirection vers Stripe ✅
4. Utilisateur ferme la fenêtre ❌
5. Commande reste en 'pending' POUR TOUJOURS ❌
```

**Données réelles:**
```sql
SELECT status, COUNT(*) FROM orders GROUP BY status;
-- Résultat probable:
-- 'pending': 50+  ← Commandes abandonnées
-- 'paid': 10
```

**Conséquences:**
- 📊 Fausse statistiques de vente
- 🗄️ Pollution de la base de données
- 🐛 Confusion pour les utilisateurs et admins

**Solution manquante:**
- Pas de job de nettoyage automatique
- Pas d'expiration des commandes pending
- Pas de notification de rappel

**Impact:** 🟠 **MAJEUR** - Affecte l'intégrité des données

---

### 4. 🟠 MAJEUR: Gestion des Billets via LocalStorage

**Problème:**
Les billets d'événement sont stockés dans `localStorage` au lieu d'être liés directement à la commande.

**Code problématique:**
```typescript
// Cart.tsx lignes 142-144
if (eventTickets.length > 0) {
  localStorage.setItem('pendingOrderId', order.id);
  localStorage.setItem('pendingEventTickets', JSON.stringify(eventTickets)); // ⚠️
}
```

**Problèmes:**
1. **Données volatiles**: Si l'utilisateur vide son cache → données perdues
2. **Multi-device**: Impossible de continuer sur un autre appareil
3. **Pas de backup**: Aucune trace si le localStorage est effacé
4. **Race condition**: Si plusieurs onglets sont ouverts

**Exemple de perte de données:**
```
1. User achète 5 billets à 50€ = 250€
2. Paiement Stripe réussi ✅
3. AVANT que le frontend traite les billets:
   - L'utilisateur ferme l'onglet
   - Le localStorage est vidé
4. Les billets n'existent plus nulle part ❌
5. L'utilisateur a payé 250€ mais n'a RIEN ❌
```

**Impact:** 🟠 **MAJEUR** - Perte de données utilisateur

---

### 5. 🟡 IMPORTANT: Pas de Réservation de Stock

**Problème:**
Quand un utilisateur ajoute un produit au panier et commence le checkout, **le stock n'est pas réservé**.

**Scénario de survente:**
```
État initial: Produit "T-Shirt XL" → stock = 1

Timeline:
10:00:00 - User A ajoute au panier (stock toujours = 1)
10:00:05 - User B ajoute au panier (stock toujours = 1)
10:00:10 - User A clique "Commander" (commande créée, stock = 1)
10:00:15 - User B clique "Commander" (commande créée, stock = 1) ⚠️
10:00:20 - User A paie (stock devient 0) ✅
10:00:25 - User B paie (stock = -1) ❌ SURVENTE

Résultat: 2 commandes payées, 1 seul produit en stock
```

**Conséquences:**
- 📦 Commandes impossibles à honorer
- 😠 Clients mécontents
- 💸 Remboursements forcés
- ⭐ Mauvaise réputation

**Impact:** 🟡 **IMPORTANT** - Problèmes opérationnels

---

### 6. 🟡 IMPORTANT: Manque d'Audit Trail

**Problème:**
Aucun historique des changements de statut des commandes.

**Informations perdues:**
- ❌ Quand la commande est passée de `pending` à `paid`?
- ❌ Qui a marqué la commande comme `shipped`?
- ❌ Pourquoi une commande est `cancelled`?
- ❌ Combien de temps entre création et paiement?

**Cas d'usage bloqués:**
- Support client: "Pourquoi ma commande est annulée?"
- Admin: "Qui a modifié cette commande?"
- Analytics: "Quel est le taux de conversion du panier?"
- Audit: "Qui a accès aux données de commande?"

**Impact:** 🟡 **IMPORTANT** - Manque de traçabilité

---

### 7. 🟡 IMPORTANT: Incohérence du Flux de Paiement

**Problème:**
Le flux de paiement mélange produits physiques et billets d'événement avec une logique complexe.

**Complexité inutile:**
```typescript
// Cart.tsx - 3 types de calculs différents
const productsTotal = cart.reduce(...);      // Ligne 46
const eventTicketsTotal = eventTickets.reduce(...); // Ligne 48
const total = productsTotal + eventTicketsTotal;    // Ligne 55
```

**Problèmes:**
1. **Duplication de logique**: Prix membre vs prix normal répété 3 fois
2. **Conditions imbriquées**: `if (event_pass && ticket_categories && selectedSize)` difficile à maintenir
3. **Pas de source unique de vérité**: Les prix sont calculés partout

**Impact:** 🟡 **IMPORTANT** - Dette technique

---

## 📊 Tableau Récapitulatif

| Problème | Sévérité | Impact | Effort Fix | Priorité |
|----------|----------|--------|------------|----------|
| Manque migration SQL | 🔴 CRITIQUE | Déploiement | 1h | P0 |
| Validation prix client | 🔴 CRITIQUE | Sécurité/Argent | 4h | P0 |
| Commandes orphelines | 🟠 MAJEUR | Données | 3h | P1 |
| Billets localStorage | 🟠 MAJEUR | Perte données | 5h | P1 |
| Pas de réservation stock | 🟡 IMPORTANT | Survente | 6h | P2 |
| Manque audit trail | 🟡 IMPORTANT | Traçabilité | 4h | P2 |
| Flux incohérent | 🟡 IMPORTANT | Maintenabilité | 8h | P3 |

**Total effort estimé:** ~31 heures (1 semaine de développement)

---

## 🔍 Analyse Détaillée du Code

### Structure Actuelle des Tables

```sql
-- Table: orders (8 rows existantes)
CREATE TABLE orders (
  id uuid PRIMARY KEY,
  user_id uuid,  -- ⚠️ nullable (pourquoi?)
  status text CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled')),
  total_amount numeric,  -- ⚠️ Pas de validation
  is_member_order boolean,
  shipping_name text,
  shipping_email text,
  shipping_phone text,
  shipping_address text,
  notes text,
  stripe_payment_intent_id text,  -- Ajouté plus tard
  created_at timestamptz,
  updated_at timestamptz
);

-- Table: order_items (8 rows existantes)
CREATE TABLE order_items (
  id uuid PRIMARY KEY,
  order_id uuid REFERENCES orders(id),
  product_id uuid,  -- ⚠️ nullable (pourquoi?)
  product_name text,  -- Dénormalisé (bon)
  quantity integer,
  unit_price numeric,  -- ⚠️ Pas de validation
  details jsonb,
  created_at timestamptz
);
```

### Flux de Commande Actuel

```
┌─────────────┐
│   Client    │
│  (Cart.tsx) │
└──────┬──────┘
       │ 1. Calcule total côté client ⚠️
       │
       ▼
┌──────────────────────────────────┐
│  Supabase: INSERT orders         │
│  - status: 'pending'             │
│  - total_amount: (calculé client)│ ⚠️
└──────────┬───────────────────────┘
           │ 2. Commande créée
           │
           ▼
┌──────────────────────────────────┐
│  Supabase: INSERT order_items    │
│  - Multiple inserts              │
└──────────┬───────────────────────┘
           │ 3. Items ajoutés
           │
           ▼
┌──────────────────────────────────┐
│  localStorage (si billets)       │ ⚠️
│  - pendingOrderId                │
│  - pendingEventTickets (JSON)    │
└──────────┬───────────────────────┘
           │ 4. Données volatiles
           │
           ▼
┌──────────────────────────────────┐
│  Edge Function                   │
│  create-stripe-checkout          │
└──────────┬───────────────────────┘
           │ 5. Crée session Stripe
           │
           ▼
┌──────────────────────────────────┐
│  Stripe Checkout Page            │
│  - User paie (ou abandonne)      │
└──────────┬───────────────────────┘
           │ 6. Si paiement réussi
           │
           ▼
┌──────────────────────────────────┐
│  Stripe Webhook                  │
│  stripe-webhook/index.ts         │
└──────────┬───────────────────────┘
           │ 7. Met à jour status
           │
           ▼
┌──────────────────────────────────┐
│  Supabase: UPDATE orders         │
│  SET status = 'paid'             │
│  WHERE id = order_id             │
└──────────────────────────────────┘
```

**🚨 Points de défaillance:**
- ❌ Entre étape 1 et 2: Prix manipulable
- ❌ Entre étape 4 et 5: Données perdues si localStorage vidé
- ❌ Entre étape 5 et 6: Commande orpheline si abandon
- ❌ Aucune validation serveur des prix

---

## 💡 Solutions Recommandées

### Solution 1: Créer la Migration Manquante (P0)

```sql
-- supabase/migrations/YYYYMMDD_create_orders_system.sql

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- NOT NULL
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled')),
  total_amount numeric(10,2) NOT NULL CHECK (total_amount >= 0),  -- Validation
  is_member_order boolean DEFAULT false,
  shipping_name text NOT NULL DEFAULT '',
  shipping_email text NOT NULL DEFAULT '',
  shipping_phone text DEFAULT '',
  shipping_address text DEFAULT '',
  notes text DEFAULT '',
  stripe_payment_intent_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours')  -- Auto-expiration
);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,  -- Garde historique
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(10,2) NOT NULL CHECK (unit_price >= 0),
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index pour performance
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_expires_at ON orders(expires_at) WHERE status = 'pending';
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.user_id = auth.uid()
  ));
```

---

### Solution 2: Validation Serveur des Prix (P0)

**Créer Edge Function:** `validate-and-create-order`

```typescript
// supabase/functions/validate-and-create-order/index.ts

interface OrderRequest {
  items: Array<{
    product_id?: string;
    event_ticket_type_id?: string;
    quantity: number;
    selected_size?: string;
  }>;
  shipping_info: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    notes?: string;
  };
}

async function validateAndCreateOrder(supabase, userId, request: OrderRequest) {
  // 1. Récupérer les prix RÉELS depuis la base de données
  const productIds = request.items
    .filter(i => i.product_id)
    .map(i => i.product_id);

  const { data: products } = await supabase
    .from('products')
    .select('id, price, member_price, stock')
    .in('id', productIds);

  const { data: userProfile } = await supabase
    .from('profiles')
    .select('platform_subscription_status, platform_subscription_expires_at')
    .eq('id', userId)
    .single();

  const isMember = userProfile.platform_subscription_status === 'active';

  // 2. Calculer le total CÔTÉ SERVEUR
  let total = 0;
  const validatedItems = [];

  for (const item of request.items) {
    if (item.product_id) {
      const product = products.find(p => p.id === item.product_id);
      if (!product) throw new Error(`Product ${item.product_id} not found`);

      // Vérifier stock
      if (product.stock >= 0 && product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.id}`);
      }

      const price = isMember ? product.member_price : product.price;
      total += price * item.quantity;

      validatedItems.push({
        product_id: product.id,
        quantity: item.quantity,
        unit_price: price,
      });
    }
  }

  // 3. Créer la commande avec le prix VALIDÉ
  const { data: order } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      total_amount: total,  // ✅ Calculé côté serveur
      is_member_order: isMember,
      shipping_name: request.shipping_info.name,
      shipping_email: request.shipping_info.email,
      shipping_phone: request.shipping_info.phone,
      shipping_address: request.shipping_info.address,
      notes: request.shipping_info.notes,
      status: 'pending',
    })
    .select()
    .single();

  // 4. Insérer les items
  const orderItems = validatedItems.map(item => ({
    ...item,
    order_id: order.id,
  }));

  await supabase.from('order_items').insert(orderItems);

  return { order, validatedItems, total };
}
```

---

### Solution 3: Nettoyage des Commandes Orphelines (P1)

**Job automatique avec pg_cron (à ajouter dans une migration):**

```sql
-- Nettoyer les commandes pending de plus de 24h
CREATE OR REPLACE FUNCTION cleanup_expired_orders()
RETURNS void AS $$
BEGIN
  -- Annuler les commandes expirées
  UPDATE orders
  SET status = 'cancelled',
      notes = COALESCE(notes || ' ', '') || '[Auto-cancelled: expired after 24h]'
  WHERE status = 'pending'
    AND created_at < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Exécuter tous les jours à 2h du matin
SELECT cron.schedule('cleanup-expired-orders', '0 2 * * *', 'SELECT cleanup_expired_orders()');
```

**Alternative: Edge Function appelée par un cron externe**

---

### Solution 4: Lier les Billets à la Commande (P1)

**Nouvelle table:**

```sql
CREATE TABLE pending_event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_ticket_type_id uuid NOT NULL REFERENCES event_ticket_types(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz DEFAULT now()
);
```

**Modifier Cart.tsx:**

```typescript
// Au lieu de localStorage
if (eventTickets.length > 0) {
  const pendingAttendees = eventTickets.map(ticket => ({
    order_id: order.id,
    event_ticket_type_id: ticket.eventTicketType.id,
    quantity: ticket.quantity,
  }));

  await supabase
    .from('pending_event_attendees')
    .insert(pendingAttendees);
}
```

---

### Solution 5: Réservation Temporaire de Stock (P2)

**Nouvelle table:**

```sql
CREATE TABLE stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  order_id uuid NOT NULL REFERENCES orders(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz DEFAULT now()
);

-- Index pour nettoyage
CREATE INDEX idx_stock_reservations_expires_at
  ON stock_reservations(expires_at)
  WHERE expires_at IS NOT NULL;
```

**Fonction de réservation:**

```sql
CREATE OR REPLACE FUNCTION reserve_stock(
  p_product_id uuid,
  p_order_id uuid,
  p_quantity integer
) RETURNS boolean AS $$
DECLARE
  v_available integer;
BEGIN
  -- Vérifier stock disponible (stock réel - réservations actives)
  SELECT
    p.stock - COALESCE(SUM(sr.quantity), 0)
  INTO v_available
  FROM products p
  LEFT JOIN stock_reservations sr ON sr.product_id = p.id
    AND sr.expires_at > now()
  WHERE p.id = p_product_id
  GROUP BY p.stock;

  IF v_available >= p_quantity THEN
    -- Créer réservation
    INSERT INTO stock_reservations (product_id, order_id, quantity)
    VALUES (p_product_id, p_order_id, p_quantity);
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

---

### Solution 6: Audit Trail (P2)

**Nouvelle table:**

```sql
CREATE TABLE order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX idx_order_status_history_created_at ON order_status_history(created_at);
```

**Trigger automatique:**

```sql
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_history (
      order_id,
      old_status,
      new_status,
      changed_by,
      metadata
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),  -- User qui a fait le changement
      jsonb_build_object(
        'stripe_payment_intent_id', NEW.stripe_payment_intent_id,
        'total_amount', NEW.total_amount
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER order_status_change_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_status_change();
```

---

## 📈 Bénéfices Attendus

### Court terme (1 semaine)
- ✅ Sécurité financière assurée (validation serveur)
- ✅ Déploiement fiable (migration SQL)
- ✅ Moins de support client (moins de bugs)

### Moyen terme (1 mois)
- ✅ Zéro commande orpheline
- ✅ Zéro survente de produits
- ✅ Traçabilité complète

### Long terme (3+ mois)
- ✅ Analytics précises
- ✅ Conformité RGPD facilitée
- ✅ Base solide pour scaling

---

## 🎯 Plan d'Action Recommandé

### Phase 1 - Urgence (Semaine 1) ⚠️
- [ ] **Jour 1-2**: Créer migration SQL manquante
- [ ] **Jour 3-4**: Implémenter validation serveur des prix
- [ ] **Jour 5**: Tests et déploiement

### Phase 2 - Important (Semaine 2)
- [ ] **Jour 1-2**: Système de nettoyage des commandes
- [ ] **Jour 3-5**: Lier billets à la commande (supprimer localStorage)

### Phase 3 - Amélioration (Semaine 3)
- [ ] **Jour 1-3**: Réservation de stock
- [ ] **Jour 4-5**: Audit trail + monitoring

### Phase 4 - Optimisation (Semaine 4)
- [ ] Refactoring du flux Cart
- [ ] Tests end-to-end
- [ ] Documentation utilisateur

---

## 🔗 Fichiers Concernés

### À Créer
- `supabase/migrations/YYYYMMDD_create_orders_system.sql` ⚠️ URGENT
- `supabase/migrations/YYYYMMDD_add_stock_reservations.sql`
- `supabase/migrations/YYYYMMDD_add_order_audit_trail.sql`
- `supabase/functions/validate-and-create-order/index.ts`

### À Modifier
- `src/pages/Cart.tsx` (lignes 79-180)
- `src/lib/stripe.ts` (ligne 54-65)
- `supabase/functions/stripe-webhook/index.ts` (lignes 46-202)
- `supabase/functions/create-stripe-checkout/index.ts`

---

## 📚 Ressources Additionnelles

### Documentation Stripe
- [Validating Prices Server-Side](https://stripe.com/docs/security/best-practices#validate-prices-server-side)
- [Handling Abandoned Checkouts](https://stripe.com/docs/payments/checkout/abandoned-carts)

### Best Practices E-commerce
- [OWASP Top 10 for E-commerce](https://owasp.org/www-project-web-security-testing-guide/)
- [Inventory Management Patterns](https://martinfowler.com/eaaDev/ReservationPattern.html)

---

## 🏁 Conclusion

Le système actuel de gestion des commandes présente **des risques critiques de sécurité et d'intégrité des données**. Les 7 problèmes identifiés doivent être traités par ordre de priorité.

**Temps total estimé:** 31 heures (1 semaine de développement focus)
**ROI:** Très élevé (sécurité financière + expérience utilisateur)

**Prochaine étape recommandée:** Commencer immédiatement par la **Phase 1** (création migration + validation serveur).

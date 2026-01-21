# NEXA ACADEMY - Guide de Déploiement MVP

**Version:** 1.0
**Date:** 16 janvier 2026
**Statut:** Production Ready (avec correctifs critiques appliqués)

---

## Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Prérequis](#prérequis)
3. [Checklist Pré-Déploiement](#checklist-pré-déploiement)
4. [Configuration de la Base de Données](#configuration-de-la-base-de-données)
5. [Configuration Stripe](#configuration-stripe)
6. [Configuration Cloudflare Stream](#configuration-cloudflare-stream)
7. [Déploiement des Edge Functions](#déploiement-des-edge-functions)
8. [Variables d'Environnement](#variables-denvironnement)
9. [Tests de Validation](#tests-de-validation)
10. [Monitoring et Alertes](#monitoring-et-alertes)
11. [Rollback et Procédures d'Urgence](#rollback-et-procédures-durgence)

---

## Vue d'ensemble

Nexa Academy est une plateforme Kizomba complète avec :
- Système d'abonnements (plateforme + professeurs individuels)
- Académie vidéo avec contrôle d'accès
- Boutique merchandise avec gestion de stock
- Système d'événements et billetterie
- Notifications en temps réel

**Stack Technique:**
- Frontend: React + TypeScript + Vite + Tailwind CSS
- Backend: Supabase (PostgreSQL + Edge Functions)
- Paiements: Stripe (paiements uniques + abonnements récurrents)
- Vidéos: Cloudflare Stream

---

## Prérequis

### Comptes et Services

- [ ] Compte Supabase (projet créé)
- [ ] Compte Stripe (mode production activé)
- [ ] Compte Cloudflare (avec Stream activé)
- [ ] Nom de domaine configuré (optionnel mais recommandé)

### Outils Locaux

```bash
# Node.js et npm
node --version  # v18+ requis
npm --version

# Supabase CLI (optionnel pour migrations locales)
npm install -g supabase

# Stripe CLI (pour tester webhooks localement)
brew install stripe/stripe-cli/stripe  # macOS
# ou télécharger depuis https://stripe.com/docs/stripe-cli
```

---

## Checklist Pré-Déploiement

### 🔴 Critiques (OBLIGATOIRES)

- [ ] **Sécurité:** Tous les secrets ont été retirés du code
- [ ] **Sécurité:** Fichier .env ajouté au .gitignore
- [ ] **Sécurité:** Authentification testée sur tous les endpoints
- [ ] **Database:** Toutes les migrations appliquées dans l'ordre
- [ ] **Database:** RLS (Row Level Security) activé sur toutes les tables
- [ ] **Database:** Cron job configuré pour le nettoyage des réservations
- [ ] **Stripe:** Clés de production configurées
- [ ] **Stripe:** Webhook enregistré et testé
- [ ] **Cloudflare:** API token rotaté si exposé
- [ ] **Edge Functions:** Toutes déployées avec succès

### 🟠 Importantes (RECOMMANDÉES)

- [ ] Tests de paiement (succès + échec) effectués
- [ ] Tests d'abonnement (création + annulation) effectués
- [ ] Tests de stock (réservation + expiration) effectués
- [ ] Monitoring configuré (Sentry ou équivalent)
- [ ] Backups automatiques configurés
- [ ] Documentation API à jour

### 🟡 Optionnelles (AMÉLIORATIONS)

- [ ] Nom de domaine personnalisé configuré
- [ ] SSL/TLS vérifié
- [ ] CDN configuré pour les assets statiques
- [ ] Tests de charge effectués
- [ ] Plan de scalabilité documenté

---

## Configuration de la Base de Données

### 1. Vérifier les Migrations

```bash
# Lister toutes les migrations
ls -la supabase/migrations/

# S'assurer qu'elles sont dans l'ordre chronologique
# Format: YYYYMMDDHHMMSS_description.sql
```

**Ordre d'Application (automatique via Supabase):**
1. `20251215093721_create_kizomba_platform_schema.sql` - Schéma de base
2. ... (toutes les migrations en ordre chronologique)
3. `20260116150000_add_order_status_notifications.sql` - Dernière migration

### 2. Vérifier que les Migrations sont Appliquées

Depuis le dashboard Supabase:
1. Aller dans **Database** > **Migrations**
2. Vérifier que toutes les migrations sont marquées comme "Applied"
3. Si des migrations sont manquantes, les appliquer via l'interface

### 3. Configurer le Cron Job

**CRITIQUE:** Le système de réservation de stock nécessite un nettoyage automatique.

```sql
-- Via l'éditeur SQL Supabase
SELECT cron.schedule(
  'cleanup-expired-stock-reservations',
  '*/15 * * * *',  -- Toutes les 15 minutes
  $$ SELECT cleanup_expired_reservations(); $$
);

-- Vérifier que le job est créé
SELECT * FROM cron.job;
```

**Alternative si pg_cron n'est pas disponible:**
- Utiliser un service externe (Vercel Cron, GitHub Actions, etc.)
- Appeler une edge function toutes les 15 minutes
- Créer une edge function `cleanup-reservations` et l'appeler via webhook

### 4. Vérifier les RLS Policies

```sql
-- Vérifier que RLS est activé sur toutes les tables critiques
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'orders', 'subscriptions',
    'video_purchases', 'program_purchases',
    'stripe_payments', 'notifications'
  );

-- Toutes doivent avoir rowsecurity = true
```

### 5. Créer des Index Manquants (Optionnel mais Recommandé)

```sql
-- Améliorer les performances des requêtes Stripe
CREATE INDEX IF NOT EXISTS idx_stripe_payments_stripe_payment_intent_id
  ON stripe_payments(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe_customer_id
  ON stripe_customers(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent_id
  ON orders(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id
  ON professor_subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription_id
  ON profiles(stripe_subscription_id);

-- Améliorer les performances des notifications
CREATE INDEX IF NOT EXISTS idx_notifications_professor_type
  ON notifications(professor_id, type) WHERE is_read = false;

-- Améliorer les performances des favoris
CREATE INDEX IF NOT EXISTS idx_favorites_item_lookup
  ON favorites(favorite_type, professor_id, video_id, program_id);
```

---

## Configuration Stripe

### 1. Créer les Produits de Subscription Plateforme

**Dashboard Stripe: Products > Add Product**

#### Abonnement Mensuel
- **Nom:** "Nexa Academy - Abonnement Mensuel"
- **Prix:** 29.99 EUR (ou votre prix)
- **Récurrence:** Mensuelle
- **Type:** Récurrent
- **Copier le Price ID:** `price_xxxxxxxxxxxxx`

#### Abonnement Annuel
- **Nom:** "Nexa Academy - Abonnement Annuel"
- **Prix:** 299.99 EUR (ou votre prix avec réduction)
- **Récurrence:** Annuelle
- **Type:** Récurrent
- **Copier le Price ID:** `price_xxxxxxxxxxxxx`

**Sauvegarder les Price IDs** dans les variables d'environnement.

### 2. Configurer le Webhook

**Dashboard Stripe: Developers > Webhooks**

#### Créer un Endpoint
1. Cliquer sur "Add endpoint"
2. **URL:** `https://[votre-projet].supabase.co/functions/v1/stripe-webhook`
3. **Description:** "Nexa Academy - Production Webhook"
4. **Version API:** Dernière version (2024-xx-xx)

#### Sélectionner les Events
```
✓ checkout.session.completed
✓ checkout.session.async_payment_succeeded
✓ checkout.session.async_payment_failed
✓ customer.subscription.created
✓ customer.subscription.updated
✓ customer.subscription.deleted
✓ payment_intent.succeeded
✓ payment_intent.payment_failed
✓ invoice.payment_succeeded
✓ invoice.payment_failed
```

#### Copier le Webhook Secret
- Après création, copier le **Signing secret** (commence par `whsec_`)
- L'ajouter dans les variables d'environnement

### 3. Tester les Paiements

```bash
# Avec Stripe CLI (local)
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# Déclencher un paiement test
stripe trigger checkout.session.completed

# Vérifier les logs
stripe logs tail
```

**En production:**
1. Effectuer un paiement réel avec une carte de test
2. Vérifier dans Dashboard Stripe > Events que les événements sont reçus
3. Vérifier dans Supabase que les données sont créées (orders, subscriptions, etc.)

### 4. Activer le Mode Production

- [ ] Passer de `sk_test_` à `sk_live_` (clé secrète)
- [ ] Passer de `pk_test_` à `pk_live_` (clé publique)
- [ ] Créer un nouveau webhook pour l'URL de production
- [ ] Mettre à jour `STRIPE_WEBHOOK_SECRET` avec le nouveau secret
- [ ] Tester un paiement réel (petit montant)

---

## Configuration Cloudflare Stream

### 1. Obtenir les Credentials

**Dashboard Cloudflare:**

1. **Account Hash:**
   - Stream > Settings > Account Details
   - Copier "Account ID hash" (format: `xxxxxxxxxxxxx`)
   - C'est `VITE_CLOUDFLARE_ACCOUNT_HASH`

2. **Account ID:**
   - Même page
   - Copier "Account ID" (format UUID)
   - C'est `CLOUDFLARE_ACCOUNT_ID`

3. **API Token:**
   - My Profile > API Tokens > Create Token
   - Template: "Edit Cloudflare Stream"
   - **Permissions:** Stream:Edit
   - **Ressources:** Include > Specific account > [Votre compte]
   - Générer et copier le token
   - C'est `CLOUDFLARE_API_TOKEN`

### 2. Activer Signed URLs (Déjà configuré dans le code)

Le code active automatiquement `requireSignedURLs` lors de l'upload.

### 3. Tester l'Upload

```bash
# Via l'interface professeur
1. Se connecter en tant que professeur
2. Aller dans Dashboard Professeur
3. Créer une nouvelle vidéo
4. Uploader un fichier test
5. Vérifier que la vidéo apparaît dans Cloudflare Stream
6. Vérifier que la lecture fonctionne avec signed URL
```

---

## Déploiement des Edge Functions

### Fonctions à Déployer

1. **create-stripe-checkout** - Création de sessions de paiement
2. **stripe-webhook** - Traitement des événements Stripe
3. **upload-cloudflare-video** - Upload de vidéos (SÉCURISÉ avec auth)
4. **get-cloudflare-video-token** - Génération de tokens de lecture
5. **validate-and-create-order** - Validation et création de commandes
6. **manage-subscription** - Gestion des abonnements
7. **manage-users** - Administration des utilisateurs
8. **check-subscription-expiration** - Vérification des expirations

### Commandes de Déploiement

Les edge functions sont déjà déployées via l'outil `mcp__supabase__deploy_edge_function`.

**Pour vérifier:**
```bash
# Via dashboard Supabase
Edge Functions > Voir la liste des fonctions déployées
```

**Pour redéployer manuellement (si nécessaire):**
```bash
supabase functions deploy create-stripe-checkout
supabase functions deploy stripe-webhook
supabase functions deploy upload-cloudflare-video
# ... etc
```

### Vérifier les Logs

```bash
# Via CLI
supabase functions logs stripe-webhook

# Via Dashboard
Edge Functions > [Nom de la fonction] > Logs
```

---

## Variables d'Environnement

### 1. Copier le Template

```bash
cp .env.example .env
```

### 2. Remplir les Valeurs

Voir `.env.example` pour la structure complète.

**Variables Client (Frontend):**
```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
VITE_CLOUDFLARE_ACCOUNT_HASH=xxxxx
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
VITE_STRIPE_PLATFORM_MONTHLY_PRICE_ID=price_xxxxx
VITE_STRIPE_PLATFORM_YEARLY_PRICE_ID=price_xxxxx
```

**Variables Serveur (Edge Functions - via Dashboard Supabase):**
```bash
CLOUDFLARE_ACCOUNT_ID=xxxxx
CLOUDFLARE_API_TOKEN=xxxxx
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### 3. Configurer sur la Plateforme d'Hosting

**Si vous utilisez Vercel/Netlify:**
1. Settings > Environment Variables
2. Ajouter toutes les variables `VITE_*`
3. Les variables sans `VITE_` restent dans Supabase

**Supabase Edge Functions (auto-injectées):**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## Tests de Validation

### 1. Tests d'Authentification

```bash
# Test signup
curl -X POST https://[projet].supabase.co/auth/v1/signup \
  -H "apikey: [anon-key]" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'

# Test signin
curl -X POST https://[projet].supabase.co/auth/v1/token?grant_type=password \
  -H "apikey: [anon-key]" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'
```

### 2. Tests de Paiement

**Scénarios à tester:**

- [ ] Paiement unique réussi (produit merchandise)
- [ ] Paiement échoué (carte refusée)
- [ ] Création d'abonnement plateforme (mensuel)
- [ ] Création d'abonnement plateforme (annuel)
- [ ] Création d'abonnement professeur
- [ ] Annulation d'abonnement
- [ ] Renouvellement automatique d'abonnement

**Cartes de test Stripe:**
```
Succès: 4242 4242 4242 4242
Échec: 4000 0000 0000 0002
3D Secure: 4000 0027 6000 3184
```

### 3. Tests de Stock

```sql
-- Vérifier le système de réservation
-- 1. Créer une commande
-- 2. Vérifier que stock_reserved est incrémenté
SELECT id, stock, stock_reserved FROM products WHERE id = '[product-id]';

-- 3. Attendre 15 minutes (ou déclencher manuellement)
SELECT cleanup_expired_reservations();

-- 4. Vérifier que les réservations expirées sont libérées
```

### 4. Tests d'Accès (RLS)

**Test 1: Utilisateur A ne peut pas voir les commandes de B**
```javascript
// User A
const { data } = await supabase
  .from('orders')
  .select('*')
  .eq('user_id', userB.id);
// Devrait retourner 0 résultats
```

**Test 2: Utilisateur non-auth ne peut pas uploader de vidéo**
```bash
curl -X POST https://[projet].supabase.co/functions/v1/upload-cloudflare-video
# Devrait retourner 401 Unauthorized
```

**Test 3: Étudiant ne peut pas voir contenu payant**
```javascript
const { data } = await supabase
  .from('videos')
  .select('*')
  .eq('visibility', 'subscribers_only');
// Ne devrait retourner que les vidéos accessibles
```

### 5. Tests de Notifications

```sql
-- Test: Créer une vidéo en tant que professeur
INSERT INTO videos (professor_id, title, visibility, ...)
VALUES ('[professor-id]', 'Test Video', 'public', ...);

-- Vérifier que les notifications sont créées
SELECT * FROM notifications
WHERE professor_id = '[professor-id]'
  AND type = 'new_video'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Monitoring et Alertes

### 1. Supabase Monitoring

**Activer dans Dashboard:**
- Database > Monitoring
- Edge Functions > Logs
- Auth > Logs

**Métriques à surveiller:**
- Taux d'erreur des fonctions (> 5%)
- Temps de réponse moyen (> 500ms)
- Requêtes lentes (> 1s)
- Connexions DB actives (> 80% capacity)

### 2. Sentry (Recommandé)

```bash
npm install @sentry/react

# Dans src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://xxxxx@sentry.io/xxxxx",
  environment: import.meta.env.MODE,
  tracesSampleRate: 1.0,
});
```

### 3. Stripe Monitoring

**Dashboard Stripe > Developers > Webhooks:**
- Vérifier "Success rate" > 95%
- Configurer alertes email pour échecs

### 4. Alertes Critiques

**À configurer:**
- [ ] Échec de paiement récurrent
- [ ] Webhook Stripe en erreur (> 10 échecs)
- [ ] Stock épuisé sur produit populaire
- [ ] Erreur 500 sur edge functions
- [ ] Base de données proche de la limite

---

## Rollback et Procédures d'Urgence

### 1. Rollback de Migration

```bash
# Si une migration cause des problèmes
# Via dashboard Supabase > Database > Migrations
# Sélectionner la migration problématique > Rollback

# OU via SQL
BEGIN;
-- Revenir à l'état précédent manuellement
ROLLBACK;
```

### 2. Désactiver une Edge Function

```bash
# Via CLI
supabase functions delete [nom-fonction]

# OU via Dashboard
Edge Functions > [Fonction] > Disable
```

### 3. Rollback Frontend

```bash
# Si déployé sur Vercel/Netlify
# Via Dashboard > Deployments > [Version précédente] > Promote to Production

# OU via CLI Vercel
vercel rollback [deployment-url]
```

### 4. Mode Maintenance

**Créer une page de maintenance:**

```html
<!-- maintenance.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Maintenance - Nexa Academy</title>
  <style>
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: sans-serif;
      background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
      color: white;
    }
    .container { text-align: center; }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
    p { color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🛠️ Maintenance en cours</h1>
    <p>Nous revenons très bientôt !</p>
  </div>
</body>
</html>
```

### 5. Backups Critiques

```sql
-- Backup des données critiques avant changement majeur
-- Utilisateurs et profiles
COPY (SELECT * FROM auth.users) TO '/tmp/users_backup.csv' CSV HEADER;
COPY (SELECT * FROM profiles) TO '/tmp/profiles_backup.csv' CSV HEADER;

-- Commandes et paiements
COPY (SELECT * FROM orders) TO '/tmp/orders_backup.csv' CSV HEADER;
COPY (SELECT * FROM stripe_payments) TO '/tmp/payments_backup.csv' CSV HEADER;

-- Abonnements
COPY (SELECT * FROM subscriptions) TO '/tmp/subscriptions_backup.csv' CSV HEADER;
COPY (SELECT * FROM professor_subscriptions) TO '/tmp/prof_subs_backup.csv' CSV HEADER;
```

**OU utiliser l'outil de backup Supabase:**
```bash
# Via Dashboard
Database > Backups > Create Backup

# Backups automatiques
Database > Settings > Enable automatic backups
```

---

## Checklist Post-Déploiement

### Jour 1

- [ ] Vérifier que tous les services sont up (frontend, edge functions, DB)
- [ ] Tester un paiement réel (petit montant)
- [ ] Vérifier que les webhooks Stripe sont reçus
- [ ] Créer un compte utilisateur test et vérifier le flow complet
- [ ] Surveiller les logs pour erreurs

### Semaine 1

- [ ] Analyser les métriques de performance
- [ ] Vérifier le taux d'erreur des paiements
- [ ] Collecter les retours utilisateurs
- [ ] Optimiser les requêtes lentes (si identifiées)
- [ ] Ajuster les limites de rate limiting si nécessaire

### Mois 1

- [ ] Analyser les tendances d'utilisation
- [ ] Planifier les optimisations de performance
- [ ] Mettre à jour la documentation basée sur les retours
- [ ] Évaluer la capacité de scalabilité
- [ ] Former l'équipe sur les procédures d'urgence

---

## Support et Contacts

**En cas de problème critique:**

1. **Supabase Support:** support@supabase.io
2. **Stripe Support:** https://support.stripe.com
3. **Cloudflare Support:** https://support.cloudflare.com

**Documentation:**
- Supabase: https://supabase.com/docs
- Stripe: https://stripe.com/docs
- Cloudflare Stream: https://developers.cloudflare.com/stream

---

## Annexes

### A. Commandes Utiles

```bash
# Vérifier l'état de la DB
supabase db status

# Exécuter une migration
supabase db push

# Voir les logs en temps réel
supabase functions logs --tail

# Tester une edge function localement
supabase functions serve stripe-webhook --env-file .env

# Build du frontend
npm run build

# Preview du build
npm run preview
```

### B. Scripts de Monitoring

```sql
-- Surveiller les commandes en attente
SELECT COUNT(*) as pending_orders
FROM orders
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '30 minutes';

-- Surveiller les réservations de stock
SELECT
  p.name,
  p.stock,
  p.stock_reserved,
  COUNT(sr.id) as active_reservations
FROM products p
LEFT JOIN stock_reservations sr ON sr.product_id = p.id
  AND sr.expires_at > NOW()
GROUP BY p.id, p.name, p.stock, p.stock_reserved
HAVING p.stock_reserved > 0;

-- Surveiller les abonnements expirant bientôt
SELECT COUNT(*) as expiring_soon
FROM subscriptions
WHERE status = 'active'
  AND current_period_end < NOW() + INTERVAL '7 days';
```

---

**Bon déploiement ! 🚀**

Pour toute question, consulter la documentation ou contacter l'équipe de développement.

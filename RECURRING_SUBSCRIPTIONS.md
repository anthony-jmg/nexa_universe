# Système d'Abonnements Récurrents Stripe

## Vue d'ensemble

Le système d'abonnements a été entièrement refactoré pour utiliser les **vrais abonnements récurrents Stripe** au lieu de paiements uniques.

## Changements principaux

### 1. Base de données

**Migration** : `add_recurring_stripe_subscriptions`

Nouveaux champs dans `profiles` :
- `stripe_subscription_id` - ID de l'abonnement Stripe actif
- `stripe_price_id` - ID du prix Stripe (monthly/yearly)
- `subscription_cancel_at_period_end` - Flag pour annulation programmée

Nouvelles fonctions SQL :
- `is_platform_subscription_active()` - Vérifie si l'abonnement est actif
- `is_professor_subscription_active()` - Vérifie l'abonnement professeur

### 2. Edge Functions

#### `create-stripe-checkout` (mis à jour)
- Support du mode `subscription` pour les abonnements récurrents
- Utilise `price_id` au lieu de créer des prix à la volée
- Métadonnées enrichies pour le tracking

#### `stripe-webhook` (amélioré)
- Gestion complète des événements d'abonnement :
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- Synchronisation automatique avec la base de données
- Notifications en cas d'échec de paiement

#### `manage-subscription` (nouveau)
- Annulation d'abonnement (accès jusqu'à fin de période)
- Réactivation d'abonnement
- Support platform et professor subscriptions

### 3. Frontend

#### Nouveau hook : `useSubscription`
- `cancelSubscription()` - Annule un abonnement
- `reactivateSubscription()` - Réactive un abonnement annulé

#### Modifications dans `Account.tsx`
- Affichage de l'avertissement si abonnement en cours d'annulation
- Bouton de réactivation si `cancel_at_period_end = true`
- Cache le bouton d'annulation si déjà programmée

#### Modifications dans `stripe.ts`
- Support du paramètre `price_id` pour les abonnements
- Métadonnées `payment_type` ajoutées pour le webhook

#### Types mis à jour
- `database.types.ts` avec les nouveaux champs du profil
- Status 'cancelled' ajouté aux statuts possibles

## Configuration requise

### 1. Créer les produits Stripe

Dans le [Stripe Dashboard](https://dashboard.stripe.com/products), créer :

1. **Platform Monthly** (8,99€/mois)
   - Metadata : `type=platform_subscription`, `plan_type=monthly`

2. **Platform Yearly** (89€/an)
   - Metadata : `type=platform_subscription`, `plan_type=yearly`

3. **Professor Monthly** (9,99€/mois)
   - Metadata : `type=professor_subscription`

### 2. Variables d'environnement

Ajouter dans `.env` :
```env
VITE_STRIPE_PLATFORM_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxx
VITE_STRIPE_PLATFORM_YEARLY_PRICE_ID=price_xxxxxxxxxxxxx
VITE_STRIPE_PROFESSOR_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxx
```

### 3. Configurer le Webhook

URL : `https://[votre-projet].supabase.co/functions/v1/stripe-webhook`

Événements à écouter :
- ✅ `checkout.session.completed`
- ✅ `customer.subscription.created`
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`
- ✅ `invoice.payment_succeeded`
- ✅ `invoice.payment_failed`

## Fonctionnalités

### ✅ Renouvellement automatique
- Stripe prélève automatiquement chaque mois/an
- Date d'expiration mise à jour automatiquement via webhook
- Aucune action manuelle requise

### ✅ Annulation propre
- L'utilisateur peut annuler depuis son compte
- Accès maintenu jusqu'à la fin de la période payée
- Flag `cancel_at_period_end` activé
- Pas de renouvellement après la période en cours

### ✅ Réactivation
- Si annulation programmée, bouton de réactivation affiché
- Réactive l'abonnement et désactive `cancel_at_period_end`
- Reprend les renouvellements automatiques

### ✅ Échec de paiement
- Stripe réessaie automatiquement (selon configuration Stripe)
- Notification créée dans la base de données
- L'utilisateur peut mettre à jour sa carte de paiement

### ✅ Synchronisation Stripe
- Tous les changements dans Stripe sont synchronisés via webhook
- Statut toujours à jour dans la base de données
- Source de vérité unique : Stripe

## Interface utilisateur

### État normal (abonné actif)
```
Platform Subscription
✓ Active
Expires on: 15/02/2026

[Benefits list]

[Cancel Subscription]
```

### Annulation programmée
```
Platform Subscription
✓ Active
⚠ Your subscription will be cancelled on 15/02/2026
   [↻ Reactivate Subscription]

[Benefits list]
```

### Pas d'abonnement
```
Platform Subscription
✗ Inactive

[Benefits list]

[Subscribe to Platform]
```

## Migration depuis l'ancien système

Les utilisateurs avec des abonnements existants (paiements uniques) :
- Continuent de fonctionner normalement jusqu'à expiration
- Peuvent s'abonner au nouveau système à tout moment
- Le nouveau système remplace l'ancien automatiquement

## Sécurité

### RLS Policies
- ✅ Utilisateurs peuvent voir uniquement leurs données
- ✅ Seul le service role peut mettre à jour via webhook
- ✅ Annulation/réactivation authentifiées

### Validation
- ✅ Signature webhook vérifiée (STRIPE_WEBHOOK_SECRET)
- ✅ Authentication requise pour toutes les actions
- ✅ Rate limiting sur les endpoints

## Testing

### En mode test Stripe

1. Utiliser une carte de test : `4242 4242 4242 4242`
2. Date d'expiration : n'importe quelle date future
3. CVC : n'importe quel 3 chiffres
4. Tester le flux complet :
   - ✅ Souscription
   - ✅ Annulation
   - ✅ Réactivation
   - ✅ Webhook events dans Stripe Dashboard

### Simulation d'événements

Dans Stripe Dashboard > Developers > Webhooks :
- Tester les événements individuellement
- Vérifier la synchronisation dans Supabase

## Avantages du nouveau système

| Ancien système | Nouveau système |
|---------------|-----------------|
| Paiement unique | Abonnement récurrent |
| Renouvellement manuel | Renouvellement automatique |
| Pas de gestion d'échec | Retry automatique + notifications |
| Annulation immédiate | Accès jusqu'à fin de période |
| Pas de réactivation | Réactivation possible |
| Calcul manuel dates | Stripe gère tout |
| Désynchronisation possible | Toujours synchronisé |

## Documentation complémentaire

- `STRIPE_SUBSCRIPTION_SETUP.md` - Guide de configuration détaillé
- [Stripe Subscriptions Docs](https://stripe.com/docs/billing/subscriptions/overview)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)

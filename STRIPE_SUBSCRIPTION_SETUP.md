# Configuration des Abonnements Stripe

## Produits à Créer dans Stripe Dashboard

Connectez-vous à votre [Stripe Dashboard](https://dashboard.stripe.com/products) et créez les produits suivants :

### 1. Abonnement Platform - Mensuel

- **Nom** : "Nexa Platform - Monthly Subscription"
- **Type** : Recurring
- **Pricing** :
  - Prix : **8,99 EUR**
  - Fréquence : **Monthly**
- **Metadata** (important) :
  - `type` = `platform_subscription`
  - `plan_type` = `monthly`

**Notez le Price ID** (commence par `price_...`)

### 2. Abonnement Platform - Annuel

- **Nom** : "Nexa Platform - Yearly Subscription"
- **Type** : Recurring
- **Pricing** :
  - Prix : **89,00 EUR**
  - Fréquence : **Yearly**
- **Metadata** (important) :
  - `type` = `platform_subscription`
  - `plan_type` = `yearly`

**Notez le Price ID** (commence par `price_...`)

## Configuration des Variables d'Environnement

Ajoutez ces Price IDs à votre fichier `.env` :

```env
VITE_STRIPE_PLATFORM_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxx
VITE_STRIPE_PLATFORM_YEARLY_PRICE_ID=price_xxxxxxxxxxxxx
```

## Abonnements Professeurs - Prix Dynamiques

Les abonnements professeurs utilisent un système de **prix dynamiques** :

- ✅ **Chaque professeur définit son propre prix** dans la base de données (champ `subscription_price`)
- ✅ **Aucun Price ID requis** - le prix est créé dynamiquement à chaque checkout
- ✅ **Renouvellement mensuel automatique** - comme les abonnements platform
- ✅ **Gestion complète via Stripe** - annulation, renouvellement, webhooks

### Comment Modifier le Prix d'un Professeur

1. Connectez-vous en tant qu'admin
2. Accédez à la section "Professors Management"
3. Modifiez le champ "Subscription Price" du professeur
4. Le nouveau prix s'appliquera immédiatement aux nouveaux abonnements

## Configuration du Webhook Stripe

1. Allez dans [Stripe Dashboard > Developers > Webhooks](https://dashboard.stripe.com/webhooks)
2. Cliquez sur "Add endpoint"
3. URL du endpoint : `https://votre-projet.supabase.co/functions/v1/stripe-webhook`
4. Sélectionnez ces événements :
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copiez le "Signing secret" (commence par `whsec_...`)
6. Ajoutez-le dans les secrets Supabase en tant que `STRIPE_WEBHOOK_SECRET`

## Fonctionnalités

### Renouvellement Automatique
✅ Les abonnements se renouvellent automatiquement chaque mois/an
✅ Stripe prélève automatiquement la carte enregistrée
✅ Le webhook met à jour la date d'expiration

### Annulation
✅ L'utilisateur peut annuler depuis son compte
✅ L'accès reste actif jusqu'à la fin de la période payée
✅ Pas de renouvellement après annulation

### Échec de Paiement
✅ Stripe réessaie automatiquement les paiements échoués
✅ L'utilisateur reçoit des emails de Stripe
✅ Le statut est mis à jour via webhook

### Réactivation
✅ L'utilisateur peut se réabonner à tout moment
✅ Un nouvel abonnement est créé dans Stripe

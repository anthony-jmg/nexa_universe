# Configuration des Abonnements NEXA Academy Platform dans Stripe

Ce guide explique comment configurer les abonnements récurrents pour la plateforme NEXA Academy dans Stripe.

## Problème

Les variables d'environnement suivantes contiennent des valeurs factices :
```
VITE_STRIPE_PLATFORM_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxx
VITE_STRIPE_PLATFORM_YEARLY_PRICE_ID=price_xxxxxxxxxxxxx
```

Vous devez créer de vrais Price IDs dans Stripe Dashboard.

## Étapes de Configuration

### 1. Accédez à Stripe Dashboard

**Mode Test :**
- [https://dashboard.stripe.com/test/products](https://dashboard.stripe.com/test/products)

**Mode Production (quand vous êtes prêt) :**
- [https://dashboard.stripe.com/products](https://dashboard.stripe.com/products)

### 2. Créez le Produit

1. Cliquez sur **"+ Add Product"** en haut à droite
2. Remplissez les informations :
   - **Name :** `NEXA Academy Platform Subscription`
   - **Description :** `Access to all NEXA Academy platform content including courses, videos, and exclusive events`
   - **Statement descriptor :** `NEXA ACADEMY` (ce qui apparaît sur la carte bancaire)

### 3. Créez le Prix Mensuel

1. Dans la section **Pricing**, ajoutez un nouveau prix :
   - **Pricing model :** `Standard pricing`
   - **Price :** Entrez votre prix (ex: `29.99 EUR`)
   - **Billing period :** `Monthly`
   - **Usage type :** `Licensed` (utilisateur paye le même montant chaque mois)

2. Options supplémentaires (optionnel mais recommandé) :
   - **Trial period :** 7 days (pour offrir une période d'essai)
   - **Price description :** `Monthly subscription to NEXA Academy`

3. Cliquez sur **"Add price"**

4. **IMPORTANT :** Copiez le Price ID qui commence par `price_...`
   - Exemple : `price_1QaBcDeFgHiJkLmN`
   - Gardez-le pour l'étape 5

### 4. Créez le Prix Annuel

1. Cliquez sur **"Add another price"** sur le même produit
2. Configurez le prix annuel :
   - **Pricing model :** `Standard pricing`
   - **Price :** Entrez votre prix annuel (ex: `299.99 EUR`)
   - **Billing period :** `Yearly`
   - **Usage type :** `Licensed`

3. Options supplémentaires :
   - **Trial period :** 7 days (optionnel)
   - **Price description :** `Yearly subscription to NEXA Academy (save 17%)`

4. Cliquez sur **"Add price"**

5. **IMPORTANT :** Copiez le Price ID annuel
   - Exemple : `price_1XyZaBcDeFgHiJkL`

### 5. Mettez à Jour le Fichier `.env`

Remplacez les valeurs factices par vos vrais Price IDs :

```bash
# Avant
VITE_STRIPE_PLATFORM_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxx
VITE_STRIPE_PLATFORM_YEARLY_PRICE_ID=price_xxxxxxxxxxxxx

# Après (avec vos vrais IDs)
VITE_STRIPE_PLATFORM_MONTHLY_PRICE_ID=price_1QaBcDeFgHiJkLmN
VITE_STRIPE_PLATFORM_YEARLY_PRICE_ID=price_1XyZaBcDeFgHiJkL
```

### 6. Redémarrez le Serveur de Développement

Après avoir modifié le `.env`, redémarrez votre serveur :

```bash
# Arrêtez le serveur (Ctrl+C)
# Puis relancez
npm run dev
```

## Tarification Recommandée

Voici des suggestions de prix basées sur les standards du marché :

| Plan | Prix | Économie |
|------|------|----------|
| **Mensuel** | 29.99 EUR/mois | - |
| **Annuel** | 299.99 EUR/an | ~17% (2 mois gratuits) |

## Vérification

Après configuration, testez la souscription :

1. Allez sur la page **Account** de votre application
2. Cliquez sur **"Subscribe to NEXA Academy"**
3. Choisissez un plan (Mensuel ou Annuel)
4. Vous devriez être redirigé vers Stripe Checkout

En mode test, utilisez ces cartes de test :
- **Succès :** `4242 4242 4242 4242`
- **Échec :** `4000 0000 0000 0002`
- **Date :** N'importe quelle date future
- **CVC :** N'importe quel 3 chiffres

## Mode Production

Quand vous êtes prêt à passer en production :

1. Créez les mêmes produits et prix dans le Dashboard Production de Stripe
2. Copiez les Price IDs de production
3. Mettez à jour votre fichier `.env.production` avec les nouveaux Price IDs
4. Assurez-vous d'utiliser :
   - `VITE_STRIPE_PUBLISHABLE_KEY` de production (commence par `pk_live_`)
   - `STRIPE_SECRET_KEY` de production (commence par `sk_live_`)

## Dépannage

### Erreur : "No such price: 'price_xxxxxxxxxxxxx'"
- Vérifiez que vous avez bien remplacé les valeurs factices dans `.env`
- Vérifiez que les Price IDs sont corrects (copiez-collez depuis Stripe Dashboard)
- Redémarrez le serveur après modification du `.env`

### L'abonnement ne se crée pas
- Vérifiez que le webhook Stripe est bien configuré (voir `STRIPE_SUBSCRIPTION_SETUP.md`)
- Vérifiez les logs dans Stripe Dashboard > Developers > Logs
- Vérifiez les logs de votre Edge Function `stripe-webhook`

### Les prix affichés ne correspondent pas
- Les prix sont définis dans `src/pages/Account.tsx`
- Assurez-vous que les prix dans le code correspondent à vos Price IDs Stripe

## Support

Si vous avez des questions :
- Documentation Stripe : [https://stripe.com/docs/billing/subscriptions/overview](https://stripe.com/docs/billing/subscriptions/overview)
- Support Stripe : [https://support.stripe.com](https://support.stripe.com)

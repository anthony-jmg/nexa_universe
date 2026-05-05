# Basculer vers Stripe Production

## Étapes à suivre pour utiliser l'environnement de production Stripe

### 1. Récupérer vos clés de production Stripe

1. Allez sur https://dashboard.stripe.com/
2. **IMPORTANT:** Désactivez le mode "Test" en haut à gauche (toggle à OFF)
3. Allez dans **Developers > API keys**
4. Récupérez vos clés de PRODUCTION :
   - **Publishable key** (commence par `pk_live_`)
   - **Secret key** (commence par `sk_live_`) - cliquez sur "Reveal" pour la voir

### 2. Récupérer vos Price IDs de production

1. Toujours en mode Production, allez sur https://dashboard.stripe.com/products
2. Trouvez votre produit "NEXA Academy Monthly Subscription"
   - Cliquez dessus
   - Copiez le Price ID (commence par `price_`)
3. Trouvez votre produit "NEXA Academy Yearly Subscription"
   - Cliquez dessus
   - Copiez le Price ID (commence par `price_`)

### 3. Mettre à jour le fichier .env LOCAL

Remplacez dans votre fichier `.env` :

```bash
# Changez ces lignes (de TEST à LIVE):
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_VOTRE_CLE_PUBLISHABLE_PRODUCTION
STRIPE_SECRET_KEY=sk_live_VOTRE_CLE_SECRET_PRODUCTION

# Mettez à jour les Price IDs avec ceux de production:
VITE_STRIPE_PLATFORM_MONTHLY_PRICE_ID=price_VOTRE_PRICE_ID_MENSUEL_PRODUCTION
VITE_STRIPE_PLATFORM_YEARLY_PRICE_ID=price_VOTRE_PRICE_ID_ANNUEL_PRODUCTION
```

**Note:** Le webhook secret sera configuré à l'étape 5.

### 4. Configurer les secrets Supabase Edge Functions

Les Edge Functions ont besoin des clés Stripe côté serveur :

```bash
# Connectez-vous à Supabase CLI (si pas déjà fait)
npx supabase login

# Liez votre projet (si pas déjà fait)
npx supabase link --project-ref uudqzxapwvkwugmtkqhl

# Configurez les secrets de production
npx supabase secrets set STRIPE_SECRET_KEY=sk_live_VOTRE_CLE_SECRET_PRODUCTION
```

**Alternative via Dashboard Supabase:**
1. Allez sur https://supabase.com/dashboard/project/uudqzxapwvkwugmtkqhl/settings/functions
2. Dans "Function Secrets", ajoutez/modifiez:
   - `STRIPE_SECRET_KEY` = votre clé `sk_live_...`

### 5. Configurer le webhook Stripe de PRODUCTION

1. Allez sur https://dashboard.stripe.com/webhooks (en mode Production)
2. Cliquez sur "Add endpoint"
3. Entrez l'URL de votre webhook :
   ```
   https://uudqzxapwvkwugmtkqhl.supabase.co/functions/v1/stripe-webhook
   ```
4. Sélectionnez les événements à écouter :
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Cliquez sur "Add endpoint"
6. Copiez le "Signing secret" (commence par `whsec_`)
7. Ajoutez-le dans votre `.env` :
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_VOTRE_WEBHOOK_SECRET_PRODUCTION
   ```
8. Configurez aussi ce secret dans Supabase :
   ```bash
   npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_VOTRE_WEBHOOK_SECRET_PRODUCTION
   ```

### 6. Redéployer les Edge Functions

Après avoir configuré les secrets, redéployez vos Edge Functions :

```bash
npx supabase functions deploy stripe-webhook
npx supabase functions deploy create-stripe-checkout
```

### 7. Tester en local

1. Arrêtez votre serveur de développement
2. Redémarrez-le : `npm run dev`
3. Testez un abonnement en utilisant une carte de test Stripe :
   - Numéro : `4242 4242 4242 4242`
   - Date : n'importe quelle date future
   - CVC : n'importe quel 3 chiffres

**ATTENTION:** En production, utilisez de vraies cartes bancaires !

### 8. Variables d'environnement sur votre plateforme d'hébergement

Si vous déployez sur Vercel, Netlify, etc., mettez à jour les variables d'environnement :

- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_STRIPE_PLATFORM_MONTHLY_PRICE_ID`
- `VITE_STRIPE_PLATFORM_YEARLY_PRICE_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SITE_URL`
- `VITE_CLOUDFLARE_ACCOUNT_HASH`

**Note:** Les secrets serveur (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) sont dans Supabase, pas dans Vercel.

## Checklist finale

- [ ] Clés Stripe changées de TEST à LIVE dans `.env`
- [ ] Price IDs de production récupérés et mis à jour
- [ ] Secrets Supabase Edge Functions configurés
- [ ] Webhook Stripe de production créé et configuré
- [ ] Edge Functions redéployées
- [ ] Test local réussi
- [ ] Variables d'environnement mises à jour sur la plateforme d'hébergement
- [ ] Test en production réussi

## En cas de problème

Si vous voyez toujours l'erreur "No such price", vérifiez :

1. Que vous avez bien copié les Price IDs depuis le mode PRODUCTION (pas TEST)
2. Que vous avez redémarré votre serveur de développement
3. Que les Price IDs dans votre Dashboard Stripe correspondent exactement à ceux dans `.env`
4. Dans la console du navigateur : `console.log(import.meta.env.VITE_STRIPE_PLATFORM_MONTHLY_PRICE_ID)`

## Aide supplémentaire

- Documentation Stripe : https://stripe.com/docs/keys
- Dashboard Stripe : https://dashboard.stripe.com/
- Supabase Functions : https://supabase.com/dashboard/project/uudqzxapwvkwugmtkqhl/settings/functions

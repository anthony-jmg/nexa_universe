# Guide de Déploiement Vercel - Nexa Academy

Ce guide vous accompagne pas à pas dans le déploiement de Nexa Academy sur Vercel.

---

## Table des Matières

1. [Prérequis](#prérequis)
2. [Préparation Avant Déploiement](#préparation-avant-déploiement)
3. [Déploiement sur Vercel](#déploiement-sur-vercel)
4. [Configuration des Variables d'Environnement](#configuration-des-variables-denvironnement)
5. [Configuration du Domaine](#configuration-du-domaine)
6. [Tests Post-Déploiement](#tests-post-déploiement)
7. [Maintenance et Mises à Jour](#maintenance-et-mises-à-jour)

---

## Prérequis

### Comptes Requis

- [x] Compte GitHub avec le repository du projet
- [x] Compte Vercel (gratuit ou Pro)
- [x] Projet Supabase configuré et fonctionnel
- [x] Compte Stripe avec clés de production
- [x] Compte Cloudflare Stream configuré

### Vérifications Locales

Avant de déployer, assurez-vous que tout fonctionne en local :

```bash
# Test du build
npm run build

# Le build doit réussir sans erreurs
# Vérifier que le dossier dist/ est créé

# Test du preview
npm run preview
# Ouvrir http://localhost:4173 et tester l'application
```

---

## Préparation Avant Déploiement

### 1. Vérifier le fichier .gitignore

Assurez-vous que les fichiers sensibles ne sont pas commités :

```bash
# Vérifier que .env est ignoré
cat .gitignore | grep .env

# Devrait afficher:
# .env
# .env.local
# .env.production
```

### 2. Nettoyer le Repository

```bash
# Supprimer les fichiers de développement du cache Git
git rm --cached .env 2>/dev/null || true

# Commiter tous les changements
git add .
git commit -m "chore: prepare for Vercel deployment"
git push origin main
```

### 3. Préparer les Variables d'Environnement

Créez un fichier temporaire `vercel-env.txt` avec toutes vos variables (NE PAS COMMITER CE FICHIER) :

```bash
# Variables Frontend (OBLIGATOIRES)
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_CLOUDFLARE_ACCOUNT_HASH=votre_account_hash
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_STRIPE_PLATFORM_MONTHLY_PRICE_ID=price_...
VITE_STRIPE_PLATFORM_YEARLY_PRICE_ID=price_...
```

**IMPORTANT:** Les variables serveur (STRIPE_SECRET_KEY, etc.) restent dans Supabase Edge Functions, pas dans Vercel.

---

## Déploiement sur Vercel

### Option 1: Déploiement via l'Interface Vercel (Recommandé)

1. **Aller sur Vercel:**
   - Visitez [vercel.com](https://vercel.com)
   - Cliquez sur "Sign Up" ou "Log In"
   - Connectez votre compte GitHub

2. **Importer le Projet:**
   - Cliquez sur "Add New Project"
   - Sélectionnez votre repository GitHub "nexa-academy"
   - Cliquez sur "Import"

3. **Configurer le Projet:**
   - **Framework Preset:** Vite (détecté automatiquement)
   - **Root Directory:** `./` (racine du projet)
   - **Build Command:** `npm run build` (automatique)
   - **Output Directory:** `dist` (automatique)
   - **Install Command:** `npm install` (automatique)

4. **Ne pas déployer encore !** Cliquez sur "Environment Variables" d'abord.

### Option 2: Déploiement via la CLI Vercel

```bash
# Installer la CLI Vercel
npm i -g vercel

# Se connecter
vercel login

# Déployer (suivre les prompts)
vercel

# Répondre aux questions:
# ? Set up and deploy "~/nexa-academy"? [Y/n] y
# ? Which scope? Your Personal Account
# ? Link to existing project? [y/N] n
# ? What's your project's name? nexa-academy
# ? In which directory is your code located? ./
# ? Want to modify these settings? [y/N] n

# Le projet sera déployé avec une URL temporaire
# Ne pas encore passer en production !
```

---

## Configuration des Variables d'Environnement

### Via l'Interface Vercel

1. **Accéder aux Variables:**
   - Dans votre projet Vercel
   - Aller dans "Settings" > "Environment Variables"

2. **Ajouter les Variables (une par une):**

   Pour chaque variable, cliquez sur "Add New":

   | Name | Value | Environments |
   |------|-------|--------------|
   | `VITE_SUPABASE_URL` | `https://votre-projet.supabase.co` | Production, Preview, Development |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbG...` | Production, Preview, Development |
   | `VITE_CLOUDFLARE_ACCOUNT_HASH` | `votre_hash` | Production, Preview, Development |
   | `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` (production) | Production |
   | `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` (test) | Preview, Development |
   | `VITE_STRIPE_PLATFORM_MONTHLY_PRICE_ID` | `price_...` | Production, Preview, Development |
   | `VITE_STRIPE_PLATFORM_YEARLY_PRICE_ID` | `price_...` | Production, Preview, Development |

   **Important:**
   - Cochez "Production" pour les variables de production
   - Cochez "Preview" et "Development" pour les variables de test/dev
   - Utilisez les clés Stripe de TEST pour Preview/Development
   - Utilisez les clés Stripe de PRODUCTION pour Production

3. **Sauvegarder:**
   - Cliquez sur "Save" après chaque variable

### Via la CLI Vercel

```bash
# Ajouter une variable pour tous les environnements
vercel env add VITE_SUPABASE_URL production preview development

# Ajouter une variable uniquement pour production
vercel env add VITE_STRIPE_PUBLISHABLE_KEY production

# Lister toutes les variables
vercel env ls
```

---

## Déployer en Production

### Via l'Interface

1. Après avoir configuré toutes les variables d'environnement
2. Allez dans l'onglet "Deployments"
3. Cliquez sur "Redeploy" sur le dernier déploiement
4. Ou faites un nouveau push sur GitHub (déploiement automatique)

### Via la CLI

```bash
# Déployer en production
vercel --prod

# L'URL de production sera affichée
# Exemple: https://nexa-academy.vercel.app
```

---

## Configuration du Domaine

### Ajouter un Domaine Personnalisé

1. **Dans Vercel:**
   - Settings > Domains
   - Cliquez sur "Add"
   - Entrez votre domaine (ex: `nexaacademy.com`)

2. **Configurer le DNS:**

   Chez votre registrar de domaine (OVH, Namecheap, etc.), ajoutez ces enregistrements :

   **Option A: Avec Sous-domaine (Recommandé)**
   ```
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

   **Option B: Domaine Apex (Racine)**
   ```
   Type: A
   Name: @
   Value: 76.76.21.21
   ```

3. **Vérifier:**
   - Attendre la propagation DNS (5-30 minutes)
   - Vercel vérifiera automatiquement
   - Le certificat SSL sera généré automatiquement

4. **Redirection:**
   - Dans Vercel > Settings > Domains
   - Configurer la redirection de `nexaacademy.com` vers `www.nexaacademy.com` (ou inverse)

---

## Configuration Post-Déploiement

### 1. Mettre à Jour le Webhook Stripe

Le webhook Stripe doit pointer vers votre Supabase (pas Vercel) :

```
URL: https://votre-projet.supabase.co/functions/v1/stripe-webhook
```

**IMPORTANT:** Le frontend (Vercel) communique avec les Edge Functions (Supabase) qui gèrent les paiements.

### 2. Configurer les CORS dans Supabase

Si nécessaire, ajoutez votre domaine Vercel aux origines autorisées :

1. Dashboard Supabase > Settings > API
2. Dans "Additional CORS Allowed Origins", ajoutez :
   ```
   https://votre-domaine.vercel.app
   https://www.votredomaine.com
   ```

### 3. Tester les Edge Functions depuis Vercel

Vérifiez que le frontend peut appeler les Edge Functions :

```javascript
// Ouvrir la console dans votre app déployée
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`,
  {
    headers: {
      'Authorization': `Bearer ${supabase.auth.session()?.access_token}`,
      'Content-Type': 'application/json',
    }
  }
);
console.log(await response.json());
```

---

## Tests Post-Déploiement

### Checklist Complète

- [ ] **Page d'accueil** charge correctement
- [ ] **Inscription** fonctionne (créer un compte test)
- [ ] **Connexion** fonctionne
- [ ] **Académie** affiche les vidéos publiques
- [ ] **Professeurs** affiche la liste
- [ ] **Boutique** affiche les produits
- [ ] **Événements** affiche la liste
- [ ] **Panier** fonctionne (ajouter un produit)
- [ ] **Checkout Stripe** s'ouvre correctement
- [ ] **Paiement test** fonctionne (carte `4242 4242 4242 4242`)
- [ ] **Commande** apparaît dans "Mes Achats"
- [ ] **Abonnement plateforme** fonctionne
- [ ] **Notifications** s'affichent
- [ ] **Upload vidéo** fonctionne (professeur)
- [ ] **Console** ne montre pas d'erreurs critiques

### Test avec Lighthouse

```bash
# Installer Lighthouse CLI
npm install -g lighthouse

# Tester la performance
lighthouse https://votre-domaine.vercel.app --view

# Vérifier les scores:
# - Performance: > 90
# - Accessibility: > 90
# - Best Practices: > 90
# - SEO: > 90
```

---

## Maintenance et Mises à Jour

### Déploiements Automatiques

Vercel déploie automatiquement à chaque push sur GitHub :

- **Branch `main`** → Déploiement Production
- **Autres branches** → Déploiements Preview (URLs temporaires)

### Rollback d'un Déploiement

**Via l'Interface:**
1. Deployments > Sélectionner un déploiement précédent
2. Cliquer sur les 3 points `...`
3. "Promote to Production"

**Via la CLI:**
```bash
# Lister les déploiements
vercel ls

# Promouvoir un déploiement spécifique
vercel promote [deployment-url]
```

### Vérifier les Logs

**Via l'Interface:**
- Aller dans "Deployments"
- Cliquer sur un déploiement
- Voir "Build Logs" et "Function Logs"

**Via la CLI:**
```bash
# Logs en temps réel
vercel logs --follow

# Logs d'un déploiement spécifique
vercel logs [deployment-url]
```

### Mettre à Jour les Variables d'Environnement

1. Settings > Environment Variables
2. Modifier la variable
3. **IMPORTANT:** Redéployer pour que les changements prennent effet
   - Cliquer sur "Redeploy" dans Deployments
   - Ou faire un push vide : `git commit --allow-empty -m "redeploy" && git push`

---

## Surveillance et Monitoring

### Analytics Vercel

Activez Vercel Analytics (gratuit) :

1. Settings > Analytics
2. Activer "Web Analytics"
3. Suivre les métriques de performance en temps réel

### Speed Insights

Activez Speed Insights pour monitorer les Core Web Vitals :

1. Settings > Speed Insights
2. Activer
3. Ajouter le code dans `src/main.tsx`:

```typescript
import { inject } from '@vercel/analytics';

inject();
```

### Budget de Performance

Configurez des alertes si la taille du bundle augmente trop :

```bash
# Dans package.json
{
  "scripts": {
    "build": "vite build --reporter json | vercel-bundle-analyzer"
  }
}
```

---

## Optimisations Recommandées

### 1. Edge Network

Vos assets statiques sont automatiquement distribués via le CDN global de Vercel.

### 2. Image Optimization

Pour les images statiques, utilisez `vercel/next/image` ou optimisez-les avant upload.

### 3. Compression

Vercel compresse automatiquement (Brotli/Gzip). Aucune configuration requise.

### 4. Caching

Le `vercel.json` configure déjà le cache optimal :
- Assets : 1 an (immutable)
- HTML : No cache (toujours frais)

---

## Problèmes Courants et Solutions

### Erreur: "Command npm run build failed"

**Solution:**
```bash
# Vérifier localement
npm run build

# Si ça échoue, corriger les erreurs TypeScript
npm run typecheck

# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install
```

### Erreur: "Environment variable undefined"

**Solution:**
1. Vérifier que toutes les variables commencent par `VITE_`
2. Les redéfinir dans Vercel Settings > Environment Variables
3. Redéployer

### Page blanche après déploiement

**Solution:**
1. Ouvrir la console du navigateur (F12)
2. Vérifier les erreurs JavaScript
3. Souvent causé par des variables d'environnement manquantes
4. Vérifier les logs Vercel pour plus de détails

### Redirections ne fonctionnent pas

**Solution:**
1. Vérifier que `vercel.json` contient la règle de rewrite
2. Should be already configured dans votre projet
3. Redéployer si vous avez modifié `vercel.json`

### Timeout sur les requêtes API

**Solution:**
- Les fonctions Vercel ont un timeout de 10s (gratuit) / 60s (Pro)
- Vos Edge Functions Supabase n'ont pas cette limite
- Vérifier que vous appelez bien Supabase, pas des fonctions Vercel

---

## Architecture Déployée

```
┌─────────────────┐
│   Utilisateur   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Vercel CDN     │  ← Frontend React (Static)
│  (Frontend)     │  ← Fichiers HTML/CSS/JS
└────────┬────────┘
         │
         ├─────────────────┐
         │                 │
         ▼                 ▼
┌─────────────────┐  ┌──────────────────┐
│   Supabase      │  │   Stripe API     │
│   (Backend)     │  │   (Paiements)    │
├─────────────────┤  └──────────────────┘
│ - PostgreSQL DB │
│ - Edge Functions│
│ - Auth          │
│ - Storage       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Cloudflare      │
│ Stream (Vidéos) │
└─────────────────┘
```

**Points Clés:**
- **Frontend (Vercel):** Fichiers statiques servis via CDN
- **Backend (Supabase):** Base de données + Edge Functions + Auth
- **Paiements (Stripe):** Gérés par les Edge Functions Supabase
- **Vidéos (Cloudflare):** Streaming direct depuis Cloudflare

---

## Support et Ressources

**Documentation:**
- [Vercel Docs](https://vercel.com/docs)
- [Deploying Vite on Vercel](https://vercel.com/docs/frameworks/vite)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

**Support:**
- Vercel Support: [vercel.com/support](https://vercel.com/support)
- Community Discord: [vercel.com/discord](https://vercel.com/discord)

**Monitoring:**
- Vercel Status: [vercel-status.com](https://www.vercel-status.com/)

---

## Checklist Finale

Avant de considérer le déploiement comme terminé :

- [ ] Application accessible sur le domaine de production
- [ ] Certificat SSL actif (cadenas vert dans le navigateur)
- [ ] Toutes les pages se chargent correctement
- [ ] Les paiements Stripe fonctionnent
- [ ] Les abonnements fonctionnent
- [ ] Les vidéos se lisent correctement
- [ ] Les notifications s'affichent
- [ ] Aucune erreur dans la console navigateur
- [ ] Score Lighthouse > 90 sur toutes les métriques
- [ ] Variables d'environnement de production configurées
- [ ] Webhook Stripe configuré et testé
- [ ] Monitoring et alertes activés
- [ ] Documentation à jour
- [ ] Équipe formée aux procédures de rollback

---

**Félicitations ! Votre application est maintenant en production sur Vercel ! 🎉**

Pour toute question ou problème, consultez la documentation ou contactez le support Vercel.

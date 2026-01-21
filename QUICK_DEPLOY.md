# Déploiement Rapide sur Vercel - Nexa Academy

Guide ultra-rapide pour déployer en 5 minutes.

---

## Étape 1: Préparer le Code

```bash
# Vérifier que le build fonctionne
npm run build

# Si le build réussit, continuer
git add .
git commit -m "chore: ready for deployment"
git push origin main
```

## Étape 2: Déployer sur Vercel

### Option A: Via l'Interface Web (Recommandé)

1. Aller sur [vercel.com](https://vercel.com)
2. Cliquer sur "Add New Project"
3. Importer votre repository GitHub
4. **NE PAS CLIQUER SUR DEPLOY ENCORE**

### Option B: Via la CLI

```bash
npm i -g vercel
vercel login
vercel
```

---

## Étape 3: Configurer les Variables d'Environnement

Dans Vercel > Settings > Environment Variables, ajouter :

| Variable | Valeur | Où la trouver |
|----------|--------|---------------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase Dashboard > Settings > API |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbG...` | Supabase Dashboard > Settings > API |
| `VITE_CLOUDFLARE_ACCOUNT_HASH` | `xxxxx` | Cloudflare > Stream > Settings |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | Stripe Dashboard > Developers > API Keys |
| `VITE_STRIPE_PLATFORM_MONTHLY_PRICE_ID` | `price_...` | Stripe Dashboard > Products |
| `VITE_STRIPE_PLATFORM_YEARLY_PRICE_ID` | `price_...` | Stripe Dashboard > Products |

**Important:** Cochez "Production", "Preview" et "Development" pour chaque variable.

---

## Étape 4: Déployer

Via l'interface : Cliquez sur "Deploy"

Via la CLI :
```bash
vercel --prod
```

---

## Étape 5: Tester

1. Ouvrir l'URL fournie par Vercel (ex: `https://nexa-academy.vercel.app`)
2. Créer un compte test
3. Tester un paiement avec la carte `4242 4242 4242 4242`

---

## Étape 6: Domaine Personnalisé (Optionnel)

1. Vercel > Settings > Domains
2. Ajouter votre domaine
3. Configurer le DNS chez votre registrar :
   ```
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

---

## Problèmes Courants

**Page blanche ?**
- Vérifier la console navigateur (F12)
- Vérifier que toutes les variables d'environnement sont configurées
- Redéployer après avoir ajouté les variables

**Erreurs de build ?**
```bash
npm run build  # Tester localement
npm run typecheck  # Vérifier TypeScript
```

**Paiements ne fonctionnent pas ?**
- Vérifier que `VITE_STRIPE_PUBLISHABLE_KEY` est correct
- Vérifier que le webhook Stripe pointe vers Supabase (pas Vercel)

---

## Architecture

```
Frontend (Vercel) → Supabase (Backend + Edge Functions) → Stripe
                  → Cloudflare Stream
```

Le frontend sur Vercel est purement statique et communique avec Supabase pour tout le backend.

---

## Documentation Complète

Pour plus de détails, voir :
- [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) - Guide complet
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Guide général de déploiement
- [.env.example](./.env.example) - Liste de toutes les variables

---

**C'est tout ! Votre app est maintenant en ligne ! 🚀**

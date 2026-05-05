# Configuration de la Réinitialisation de Mot de Passe

## Problème
Lorsque vous cliquez sur le lien de réinitialisation de mot de passe reçu par email, vous êtes redirigé vers la landing page au lieu de la page de réinitialisation.

## Solution Complète

### 1. Configurer les URLs dans Supabase Dashboard

**C'EST L'ÉTAPE LA PLUS IMPORTANTE**

1. Allez sur le **Dashboard Supabase** : https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Allez dans **Authentication** → **URL Configuration**
4. Configurez les sections suivantes :

#### Site URL (en haut)
- **Développement** : `http://localhost:5173`
- **Production** : `https://votre-app.vercel.app`

#### Redirect URLs (en bas)
Ajoutez TOUTES ces URLs (cliquez sur "Add URL" pour chacune) :
- `http://localhost:5173/**`
- `https://votre-app.vercel.app/**`
- `https://*.vercel.app/**` (pour les previews Vercel)

**IMPORTANT** : Le `/**` à la fin est crucial pour permettre tous les chemins.

5. Cliquez sur **Save** en bas de la page

### 2. Configurer VITE_SITE_URL

#### Sur Vercel (PRODUCTION) :

1. Allez dans les **Settings** de votre projet Vercel
2. Cliquez sur **Environment Variables**
3. Ajoutez cette variable :
   - **Name** : `VITE_SITE_URL`
   - **Value** : `https://votre-app.vercel.app` (votre URL exacte)
   - **Environment** : Cochez `Production`, `Preview`, et `Development`
4. Cliquez sur **Save**
5. **REDÉPLOYEZ** votre application (Settings → Deployments → Redeploy)

#### En local (.env) :

```env
VITE_SITE_URL=http://localhost:5173
```

### 3. Vérifier le Template Email

1. Dans **Authentication** → **Email Templates**
2. Sélectionnez **Reset Password**
3. Vérifiez que le lien utilise bien `{{ .SiteURL }}` :

```html
<a href="{{ .SiteURL }}">Réinitialiser mon mot de passe</a>
```

**NE PAS** ajouter de chemin après `{{ .SiteURL }}` (pas de `/reset-password` ou autre)

### 4. Tester en Développement

1. Lancez l'application : `npm run dev`
2. Ouvrez `http://localhost:5173`
3. Cliquez sur "Mot de passe oublié"
4. Entrez votre email
5. Dans la console de votre navigateur, vous devriez voir :
   - `=== Initial page detection ===`
   - Les logs de l'URL et du hash
6. Ouvrez l'email de réinitialisation
7. Cliquez sur le lien
8. Vous devriez voir :
   - `✅ Recovery token detected on initial load`
   - La page de réinitialisation de mot de passe

### 5. Vérifier les Logs

#### Dans la console du navigateur :
Après avoir cliqué sur le lien, vous devriez voir :
```
=== Initial page detection ===
Full URL: http://localhost:5173/#access_token=...&type=recovery
Hash: #access_token=...&type=recovery
✅ Recovery token detected on initial load - redirecting to reset-password
🔑 Recovery token detected - waiting for Supabase to process it...
🔐 AuthContext - Auth state changed: PASSWORD_RECOVERY
```

#### Dans Supabase Dashboard :
1. Allez dans **Logs** → **Auth Logs**
2. Cherchez les événements récents
3. Vérifiez qu'il n'y a pas d'erreurs de redirection

## Comment ça Fonctionne

L'application détecte les tokens de réinitialisation de 3 façons :

1. **Détection initiale** : Au chargement de la page, vérifie le hash URL
2. **Événement Supabase** : Écoute l'événement `PASSWORD_RECOVERY`
3. **AuthContext** : Attend que Supabase traite le token avant de charger

## Dépannage

### Symptômes et Solutions

#### "Je suis toujours redirigé vers la landing page"

**Causes possibles :**
1. Les Redirect URLs ne sont pas configurées dans Supabase
   - ✅ Solution : Vérifiez l'étape 1 ci-dessus
   - ✅ Ajoutez bien le `/**` à la fin des URLs

2. VITE_SITE_URL n'est pas configurée
   - ✅ Solution : Vérifiez l'étape 2 ci-dessus
   - ✅ Redéployez après avoir ajouté la variable

3. Le cache du navigateur interfère
   - ✅ Solution : Testez en navigation privée (Ctrl+Shift+N / Cmd+Shift+N)
   - ✅ Videz le cache : Ctrl+Shift+Delete

#### "L'email de réinitialisation ne contient pas le bon lien"

1. Site URL mal configurée dans Supabase
   - ✅ Vérifiez que le Site URL correspond à votre domaine
   - ✅ Pas de slash final dans le Site URL

2. Template email modifié incorrectement
   - ✅ Utilisez exactement `{{ .SiteURL }}` sans chemin supplémentaire
   - ✅ Réinitialisez le template si nécessaire

#### "Le token semble invalide ou expiré"

1. Les tokens expirent après 1 heure par défaut
   - ✅ Demandez un nouveau lien de réinitialisation

2. Le token a déjà été utilisé
   - ✅ Chaque token ne peut être utilisé qu'une seule fois

### Checklist de Vérification

- [ ] Site URL configurée dans Supabase Authentication → URL Configuration
- [ ] Redirect URLs ajoutées avec `/**` à la fin
- [ ] VITE_SITE_URL configurée dans Vercel (production)
- [ ] Application redéployée après changement de variables
- [ ] Template email vérifié (utilise `{{ .SiteURL }}`)
- [ ] Testé en navigation privée
- [ ] Cache du navigateur vidé
- [ ] Logs du navigateur vérifiés (console ouverte)

### Obtenir de l'Aide

Si le problème persiste après avoir suivi toutes ces étapes :

1. Ouvrez la console du navigateur (F12)
2. Reproduisez le problème
3. Copiez tous les logs qui commencent par :
   - `=== Initial page detection ===`
   - `🔑`, `🔐`, `✅`, `❌`
4. Vérifiez si l'URL contient bien `#access_token=` et `type=recovery`

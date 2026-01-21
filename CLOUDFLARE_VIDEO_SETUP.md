# Configuration de Cloudflare Stream pour l'Upload de Vidéos

Ce document explique comment configurer Cloudflare Stream pour permettre aux professeurs de télécharger des vidéos sur la plateforme.

## Prérequis

Vous devez avoir un compte Cloudflare avec Cloudflare Stream activé.

## Étapes de Configuration

### 1. Obtenir votre Account ID Cloudflare

1. Connectez-vous à votre [tableau de bord Cloudflare](https://dash.cloudflare.com/)
2. Dans la barre latérale, cliquez sur "Stream"
3. Votre **Account ID** s'affiche dans l'URL : `https://dash.cloudflare.com/[ACCOUNT_ID]/stream`
4. Copiez cet Account ID

### 2. Créer un API Token

1. Dans le tableau de bord Cloudflare, allez dans **Mon Profil** > **API Tokens**
   - URL directe : https://dash.cloudflare.com/profile/api-tokens
2. Cliquez sur **"Create Token"**
3. Recherchez le template **"Edit Cloudflare Stream"** ou créez un token personnalisé avec les permissions suivantes :
   - **Account** > **Stream** > **Edit**
   - **Account** > **Stream** > **Read**
4. Sélectionnez votre compte dans "Account Resources"
5. Cliquez sur **"Continue to summary"** puis **"Create Token"**
6. **Copiez immédiatement le token** (il ne sera plus visible après)

### 3. Configurer les Variables d'Environnement

Mettez à jour le fichier `.env` à la racine du projet :

```env
# Cloudflare Stream configuration (pour les utilisateurs)
VITE_CLOUDFLARE_ACCOUNT_HASH=0bt7y0ypwgmugkfi

# Cloudflare credentials for Edge Functions (server-side only, no VITE_ prefix)
CLOUDFLARE_ACCOUNT_ID=votre_account_id_ici
CLOUDFLARE_API_TOKEN=votre_api_token_ici
```

**Important :**
- `CLOUDFLARE_ACCOUNT_ID` : Remplacez par l'Account ID obtenu à l'étape 1
- `CLOUDFLARE_API_TOKEN` : Remplacez par le token créé à l'étape 2
- Ces variables n'ont PAS de préfixe `VITE_` car elles sont utilisées uniquement côté serveur

### 4. Redéployer les Edge Functions

Une fois les variables configurées dans Supabase, les edge functions utiliseront automatiquement ces credentials.

Pour Supabase hébergé :
1. Allez dans les paramètres de votre projet Supabase
2. Section **"Edge Functions"** > **"Environment Variables"**
3. Ajoutez :
   - `CLOUDFLARE_ACCOUNT_ID` = votre Account ID
   - `CLOUDFLARE_API_TOKEN` = votre API Token

## Vérification

Pour vérifier que tout fonctionne :

1. Connectez-vous en tant que professeur
2. Allez dans le tableau de bord professeur
3. Créez une nouvelle vidéo
4. Essayez de télécharger un fichier vidéo
5. Si la configuration est correcte, vous devriez voir :
   - Une barre de progression pendant l'upload
   - Un message de succès avec l'ID Cloudflare de la vidéo
   - Un rappel pour remplir le reste du formulaire

## Dépannage

### Erreur "Server configuration error"

Cette erreur indique que les variables d'environnement ne sont pas configurées correctement :
- Vérifiez que `CLOUDFLARE_ACCOUNT_ID` et `CLOUDFLARE_API_TOKEN` sont définis
- Assurez-vous qu'il n'y a pas d'espaces avant ou après les valeurs
- Pour Supabase hébergé, vérifiez que les variables sont bien configurées dans les paramètres du projet

### Erreur "Failed to upload to Cloudflare"

Cela peut indiquer :
- Le token API n'a pas les bonnes permissions (vérifiez qu'il a les droits Stream > Edit)
- Le token a expiré (créez-en un nouveau)
- L'Account ID est incorrect

### La vidéo se télécharge mais n'apparaît pas dans le dashboard

**C'est normal !** Le téléchargement sur Cloudflare ne crée pas automatiquement l'entrée dans la base de données. Vous devez :
1. Attendre que l'upload soit terminé
2. Remplir tous les champs requis du formulaire (titre, niveau, durée, etc.)
3. Cliquer sur le bouton **"Ajouter la Vidéo"** pour finaliser la création

## Sécurité

- Les vidéos sont automatiquement configurées avec `requireSignedURLs: true` pour sécuriser l'accès
- Seuls les utilisateurs autorisés peuvent obtenir des URLs signées via l'edge function `get-cloudflare-video-token`
- Le token API ne doit **jamais** être exposé côté client (pas de préfixe `VITE_`)

## Ressources

- [Documentation Cloudflare Stream](https://developers.cloudflare.com/stream/)
- [API Reference](https://developers.cloudflare.com/api/operations/stream-videos-upload-videos-via-basic-upload)
- [Signed URLs Documentation](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/)

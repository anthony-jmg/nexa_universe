# Configuration Cloudflare Stream

Ce guide vous explique comment configurer Cloudflare Stream pour votre plateforme vidéo.

## Étape 1 : Créer un compte Cloudflare Stream

1. Allez sur [dash.cloudflare.com](https://dash.cloudflare.com)
2. Créez un compte ou connectez-vous
3. Dans le menu de gauche, cliquez sur **Stream**
4. Activez Cloudflare Stream (gratuit pour commencer)

## Étape 2 : Configurer les Signing Keys (sécurité)

Pour sécuriser vos vidéos avec des tokens signés :

1. Dans Cloudflare Stream, allez dans **Settings** → **Security**
2. Cliquez sur **Create signing key**
3. Donnez un nom à votre clé (ex: "production-key")
4. Copiez le **Key ID** et la **Private Key (RSA)**

## Étape 3 : Obtenir vos identifiants API

1. Dans Cloudflare Stream, allez dans **API Tokens**
2. Créez un API Token avec les permissions suivantes :
   - Account → Stream → Edit
3. Copiez le token généré (vous ne pourrez plus le voir après)
4. Notez aussi votre **Account ID** (visible dans l'URL ou dans la page Overview)

## Étape 4 : Configurer les variables d'environnement

### Variables Frontend (.env)

Ajoutez dans votre fichier `.env` :

```env
VITE_CLOUDFLARE_ACCOUNT_HASH=votre_account_hash
```

Pour trouver votre `account_hash` :
- Uploadez une vidéo test dans Cloudflare Stream
- Cliquez sur la vidéo
- Dans l'URL du player, vous verrez : `https://customer-XXXXX.cloudflarestream.com/...`
- Le `XXXXX` est votre account hash

### Variables Supabase Edge Function

Dans votre dashboard Supabase (Settings → Edge Functions → Secrets), ajoutez :

```
CLOUDFLARE_ACCOUNT_ID=votre_account_id
CLOUDFLARE_API_TOKEN=votre_api_token
CLOUDFLARE_STREAM_KEY_ID=votre_key_id
CLOUDFLARE_STREAM_SIGNING_KEY=votre_private_key_rsa
```

**Notes importantes :**
- `CLOUDFLARE_ACCOUNT_ID` : Votre Account ID Cloudflare
- `CLOUDFLARE_API_TOKEN` : Le token API avec permissions Stream
- `CLOUDFLARE_STREAM_KEY_ID` : L'ID de la clé de signature (pour la lecture sécurisée)
- `CLOUDFLARE_STREAM_SIGNING_KEY` : La clé privée RSA complète avec BEGIN/END

⚠️ **Important** : La clé privée RSA doit inclure les lignes BEGIN et END :
```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----
```

## Étape 5 : Uploader des vidéos

### 🎉 Upload Automatique (Recommandé)

L'upload est maintenant **entièrement automatisé** dans votre plateforme !

**Pour les Professeurs :**
1. Allez dans votre **Tableau de Bord**
2. Cliquez sur l'onglet **Vidéos**
3. Cliquez sur **Nouvelle Vidéo**
4. Remplissez le titre (important pour identifier la vidéo)
5. Dans la section "Vidéo", cliquez pour **sélectionner votre fichier**
6. L'upload démarre automatiquement avec une barre de progression
7. Une fois terminé, le Video ID est automatiquement enregistré
8. Remplissez les autres informations et sauvegardez

**Limites :**
- Taille maximale : 500 MB par vidéo
- Formats acceptés : MP4, MOV, AVI, WebM

### Upload Manuel (Alternative)

Si vous préférez uploader manuellement via Cloudflare :

1. Allez dans **Stream** → **Videos** sur Cloudflare
2. Cliquez sur **Upload video**
3. Une fois uploadée, copiez le **Video ID** (format : `abc123def456...`)
4. Dans votre plateforme, collez le Video ID dans le champ prévu

### Via l'API (Développeurs)

L'Edge Function `upload-cloudflare-video` est disponible pour vos intégrations personnalisées :

```bash
curl -X POST \
  ${VITE_SUPABASE_URL}/functions/v1/upload-cloudflare-video \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -F file=@video.mp4 \
  -F title="Ma Vidéo"
```

## Structure de la base de données

La table `videos` contient maintenant :
- `video_url` : URL vidéo classique (rétrocompatibilité)
- `cloudflare_video_id` : ID Cloudflare Stream (nouveau, sécurisé)

Le système utilise automatiquement Cloudflare Stream si `cloudflare_video_id` est défini.

## Tarification Cloudflare Stream

- **Stockage** : 5$/1000 minutes stockées/mois
- **Streaming** : 1$/1000 minutes visionnées
- **Encodage** : Inclus gratuitement
- **Premiers 1000 minutes** : Gratuits

Exemple : 10 vidéos de 10 min = 100 min stockées = 0.50$/mois

## Support

Pour toute question :
- Documentation Cloudflare : [developers.cloudflare.com/stream](https://developers.cloudflare.com/stream/)
- Dashboard : [dash.cloudflare.com/stream](https://dash.cloudflare.com/stream)

## Sécurité

✅ **Activé par défaut** :
- Tokens signés avec expiration (1h)
- Vérification des achats utilisateur
- Protection anti-hotlinking
- Streaming HTTPS uniquement

❌ **Non inclus** :
- DRM (disponible en addon)
- Watermarking dynamique (disponible en addon)

# Guide d'Optimisation Vidéo

Ce guide vous aide à optimiser vos vidéos avant de les uploader sur la plateforme.

## Limites de la Plateforme

- **Taille maximum** : 200 MB par vidéo
- **Durée maximum** : 2 heures
- **Formats acceptés** : MP4, MOV, AVI, WebM

## Pourquoi Optimiser ?

1. **Upload plus rapide** : Les fichiers plus légers se téléchargent plus rapidement
2. **Meilleure expérience** : Cloudflare Stream optimise automatiquement toutes les vidéos après l'upload
3. **Streaming adaptatif** : Votre vidéo sera disponible en plusieurs résolutions automatiquement

## Paramètres Recommandés

### Résolution
- **1080p (1920x1080)** : Idéal pour la plupart des contenus
- **720p (1280x720)** : Bon compromis qualité/taille
- **4K non recommandé** : Trop lourd, sera de toute façon réduit

### Codec
- **H.264 (AVC)** : Meilleure compatibilité
- **H.265 (HEVC)** : Meilleure compression mais moins compatible

### Bitrate (débit)
- **1080p** : 3-5 Mbps
- **720p** : 2-3 Mbps

### Audio
- **Codec** : AAC
- **Bitrate** : 128-192 kbps
- **Canaux** : Stéréo (2 canaux)

## Outils de Compression

### 1. Handbrake (Gratuit - Recommandé)

**Téléchargement** : https://handbrake.fr/

**Configuration rapide** :
1. Ouvrez Handbrake
2. Sélectionnez votre vidéo source
3. Preset : "Fast 1080p30" ou "Fast 720p30"
4. Format : MP4
5. Codec vidéo : H.264
6. Qualité RF : 23 (bon équilibre)
7. Cliquez sur "Start Encode"

**Configuration avancée** :
```
Video:
- Codec: H.264 (x264)
- Framerate: Same as source
- Quality: RF 22-24 (plus bas = meilleure qualité)
- Encoder Preset: Medium ou Fast

Audio:
- Codec: AAC
- Bitrate: 160 kbps
- Samplerate: 48 kHz
```

### 2. FFmpeg (Ligne de commande)

**Installation** :
- Windows : https://ffmpeg.org/download.html
- Mac : `brew install ffmpeg`
- Linux : `sudo apt install ffmpeg`

**Commande de base** :
```bash
ffmpeg -i input.mp4 -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k output.mp4
```

**Réduire la résolution à 1080p** :
```bash
ffmpeg -i input.mp4 -vf scale=1920:1080 -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k output.mp4
```

**Réduire la résolution à 720p** :
```bash
ffmpeg -i input.mp4 -vf scale=1280:720 -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k output.mp4
```

**Compression aggressive (pour vidéos très lourdes)** :
```bash
ffmpeg -i input.mp4 -c:v libx264 -preset slower -crf 26 -c:a aac -b:a 96k output.mp4
```

### 3. Clipchamp (En ligne - Gratuit)

**Site** : https://clipchamp.com

**Avantages** :
- Aucune installation nécessaire
- Interface simple
- Compression dans le navigateur

**Utilisation** :
1. Créez un compte gratuit
2. Uploadez votre vidéo
3. Exportez en "1080p" avec qualité "Moyenne"
4. Téléchargez le fichier compressé

### 4. CloudConvert (En ligne)

**Site** : https://cloudconvert.com/mp4-converter

**Configuration recommandée** :
- Format de sortie : MP4
- Codec vidéo : H.264
- Résolution : 1920x1080 ou 1280x720
- Bitrate vidéo : 3000k (pour 1080p) ou 2000k (pour 720p)

### 5. Adobe Media Encoder (Payant)

Si vous avez déjà Adobe Creative Cloud :

**Preset** : YouTube 1080p HD ou Match Source - Medium bitrate

## Comparaison des Outils

| Outil | Gratuit | Facilité | Qualité | Vitesse |
|-------|---------|----------|---------|---------|
| Handbrake | ✅ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| FFmpeg | ✅ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Clipchamp | ✅ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| CloudConvert | ✅ limité | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

## Vérifier la Taille de Votre Vidéo

### Windows
Clic droit sur le fichier → Propriétés → Taille

### Mac
Clic droit sur le fichier → Obtenir des informations → Taille

### Linux
```bash
ls -lh myvideo.mp4
```

## Exemples de Tailles Typiques

### Avant optimisation
- Vidéo 1080p 30min : ~1.5 GB
- Vidéo 720p 30min : ~800 MB
- Vidéo 4K 30min : ~3-5 GB

### Après optimisation (paramètres recommandés)
- Vidéo 1080p 30min : ~180-200 MB ✅
- Vidéo 720p 30min : ~120-150 MB ✅
- Vidéo 1080p 60min : ~350 MB ❌ (dépasse la limite)

## Que Fait Cloudflare Stream ?

Après l'upload, Cloudflare Stream :

1. **Encode en plusieurs résolutions** : 1080p, 720p, 480p, 360p
2. **Optimise le codec** : Utilise des codecs modernes
3. **Streaming adaptatif** : Ajuste automatiquement la qualité selon la connexion
4. **CDN global** : Distribue votre vidéo dans le monde entier
5. **Protection DRM** : Empêche le téléchargement non autorisé

**Important** : Même si vous uploadez une vidéo de 200 MB, Cloudflare la stockera de manière optimisée et la diffusera efficacement à tous les utilisateurs.

## Conseils Supplémentaires

### Pour réduire encore plus la taille

1. **Réduire le framerate** : Passer de 60fps à 30fps
2. **Couper les parties inutiles** : Retirez intro/outro trop longs
3. **Réduire la résolution** : 720p au lieu de 1080p
4. **Augmenter la compression** : CRF 26-28 au lieu de 23

### Qualité vs Taille

- **CRF 18** : Excellente qualité, fichier lourd
- **CRF 23** : Très bonne qualité, taille raisonnable ✅ **Recommandé**
- **CRF 28** : Bonne qualité, petit fichier
- **CRF 32** : Qualité moyenne, très petit fichier

Plus le CRF est élevé, plus la compression est forte (et donc plus la taille est réduite, mais la qualité baisse).

## Problèmes Courants

### "Ma vidéo dépasse encore 200 MB"

Solutions :
1. Réduisez la résolution à 720p
2. Augmentez le CRF à 26-28
3. Réduisez le framerate à 24-30 fps
4. Coupez les parties inutiles

### "La qualité est mauvaise après compression"

Solutions :
1. Réduisez le CRF (vers 20-22)
2. Utilisez un preset plus lent (medium, slow)
3. Assurez-vous que la vidéo source est de bonne qualité

### "L'upload prend trop de temps"

Solutions :
1. Vérifiez votre connexion internet
2. Compressez davantage la vidéo
3. Essayez à un moment où le réseau est moins chargé

## Support

Si vous rencontrez des problèmes :
1. Vérifiez que votre vidéo respecte les limites (200 MB, 2h)
2. Essayez de la réencoder avec Handbrake
3. Contactez le support si le problème persiste

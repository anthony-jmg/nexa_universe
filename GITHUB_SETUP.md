# Configuration GitHub - Nexa Academy

Guide pour pousser votre code sur GitHub avant le déploiement Vercel.

---

## Étape 1: Créer un Repository GitHub

1. Aller sur [github.com](https://github.com)
2. Cliquer sur le bouton **"+"** en haut à droite > **"New repository"**
3. Remplir les informations :
   - **Repository name:** `nexa-academy` (ou le nom de votre choix)
   - **Description:** "Plateforme d'apprentissage Kizomba avec abonnements et e-commerce"
   - **Visibility:** Private (recommandé) ou Public
   - **NE PAS** cocher "Initialize this repository with a README"
   - **NE PAS** ajouter .gitignore ou license
4. Cliquer sur **"Create repository"**

GitHub vous donnera une URL comme : `https://github.com/votre-username/nexa-academy.git`

---

## Étape 2: Initialiser Git Localement

Exécutez ces commandes dans le terminal (dans le dossier de votre projet) :

```bash
# Initialiser Git (si pas déjà fait)
git init

# Vérifier que .env est ignoré
cat .gitignore | grep .env

# Ajouter tous les fichiers
git add .

# Créer le premier commit
git commit -m "feat: initial commit - Nexa Academy MVP"

# Renommer la branche en 'main' (si nécessaire)
git branch -M main
```

---

## Étape 3: Connecter au Repository GitHub

Remplacez `VOTRE_USERNAME` et `NOM_DU_REPO` par vos valeurs :

```bash
# Ajouter le remote GitHub
git remote add origin https://github.com/VOTRE_USERNAME/NOM_DU_REPO.git

# Vérifier que le remote est correct
git remote -v
# Devrait afficher:
# origin  https://github.com/VOTRE_USERNAME/NOM_DU_REPO.git (fetch)
# origin  https://github.com/VOTRE_USERNAME/NOM_DU_REPO.git (push)
```

---

## Étape 4: Pousser le Code

```bash
# Pousser le code sur GitHub
git push -u origin main
```

**Si vous avez une erreur d'authentification :**

### Option A: Token Personnel (Recommandé)

1. Aller sur GitHub > Settings > Developer settings > Personal access tokens > Tokens (classic)
2. Cliquer sur "Generate new token (classic)"
3. Nom: "Nexa Academy Deploy"
4. Cocher: `repo` (tous les sous-items)
5. Générer et copier le token (vous ne le reverrez plus !)
6. Utiliser le token comme mot de passe lors du push :
   ```bash
   # Username: votre_username
   # Password: le_token_généré
   ```

### Option B: SSH (Alternative)

```bash
# Générer une clé SSH (si vous n'en avez pas)
ssh-keygen -t ed25519 -C "votre_email@example.com"

# Copier la clé publique
cat ~/.ssh/id_ed25519.pub

# Ajouter la clé sur GitHub:
# GitHub > Settings > SSH and GPG keys > New SSH key
# Coller la clé et sauvegarder

# Changer le remote en SSH
git remote set-url origin git@github.com:VOTRE_USERNAME/NOM_DU_REPO.git

# Pousser
git push -u origin main
```

---

## Étape 5: Vérifier

1. Aller sur `https://github.com/VOTRE_USERNAME/NOM_DU_REPO`
2. Vous devriez voir tous vos fichiers
3. **Important:** Vérifier que le fichier `.env` n'est PAS visible (il doit être ignoré)

---

## Étape 6: Prêt pour Vercel !

Maintenant que votre code est sur GitHub, vous pouvez :

1. Aller sur [vercel.com](https://vercel.com)
2. Cliquer sur "Add New Project"
3. Sélectionner votre repository `nexa-academy`
4. Suivre le guide `QUICK_DEPLOY.md` ou `VERCEL_DEPLOYMENT.md`

---

## Commandes Git Utiles

```bash
# Voir l'état des fichiers
git status

# Voir l'historique des commits
git log --oneline

# Pousser des changements futurs
git add .
git commit -m "votre message"
git push

# Voir les fichiers ignorés
git status --ignored

# Vérifier qu'un fichier est bien ignoré
git check-ignore -v .env
# Devrait afficher: .gitignore:23:.env	.env
```

---

## Sécurité: Vérifier qu'aucun Secret n'est Exposé

Avant de pousser, vérifiez :

```bash
# Chercher les secrets potentiels dans le code
grep -r "sk_live_" .
grep -r "sk_test_" .
grep -r "whsec_" .

# Si vous trouvez quelque chose, NE PAS POUSSER !
# Ces secrets doivent être dans .env uniquement
```

**Si vous avez accidentellement commité des secrets :**

```bash
# NE PAS pousser !
# Modifier le dernier commit
git reset --soft HEAD~1

# Retirer les fichiers problématiques
git reset .env

# Recommiter sans les secrets
git commit -m "feat: initial commit - Nexa Academy MVP"
```

---

## Structure du Repository

Votre repository GitHub devrait contenir :

```
nexa-academy/
├── .bolt/
├── public/
├── src/
├── supabase/
├── .env.example          ✅ (template)
├── .gitignore            ✅
├── package.json          ✅
├── vite.config.ts        ✅
├── vercel.json           ✅
├── README.md             ✅
├── VERCEL_DEPLOYMENT.md  ✅
├── QUICK_DEPLOY.md       ✅
└── .env                  ❌ (NE DOIT PAS être visible sur GitHub)
```

---

## Prochaines Étapes

Une fois le code poussé sur GitHub :

1. ✅ Repository créé et code poussé
2. → Configurer Vercel (voir `QUICK_DEPLOY.md`)
3. → Ajouter les variables d'environnement
4. → Déployer en production
5. → Tester l'application

---

## Aide

**Erreur: "Permission denied (publickey)"**
- Vous devez configurer SSH ou utiliser un Personal Access Token

**Erreur: "Repository not found"**
- Vérifier l'URL du remote : `git remote -v`
- Vérifier que le repository existe sur GitHub

**Fichier .env visible sur GitHub**
- **URGENT:** Le supprimer immédiatement et regénérer tous les secrets
- Vérifier que `.env` est dans `.gitignore`
- Utiliser `git rm --cached .env` puis recommiter

---

**Bon courage ! 🚀**

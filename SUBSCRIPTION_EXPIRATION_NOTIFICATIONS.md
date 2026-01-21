# Système de Notifications d'Expiration d'Abonnements

## Vue d'ensemble

Le système envoie automatiquement des notifications aux utilisateurs avant l'expiration de leurs abonnements (plateforme et professeurs). Les notifications sont envoyées à des intervalles stratégiques pour donner aux utilisateurs le temps de renouveler.

## Types de notifications

### 1. Notifications d'expiration imminente
- **7 jours avant** l'expiration
- **3 jours avant** l'expiration
- **1 jour avant** l'expiration

### 2. Notifications d'expiration
- **Jour J** de l'expiration

### Types d'abonnements concernés

1. **Abonnement plateforme** (`platform_subscription`)
   - Type: `platform_subscription_expiring` (avant expiration)
   - Type: `platform_subscription_expired` (après expiration)
   - Lien: `/account`

2. **Abonnement professeur** (`professor_subscriptions`)
   - Type: `professor_subscription_expiring` (avant expiration)
   - Type: `professor_subscription_expired` (après expiration)
   - Lien: `/professors/{professor_id}`

## Architecture technique

### 1. Base de données

#### Table `notifications`
Stocke toutes les notifications avec les nouveaux types d'expiration.

#### Table `subscription_expiration_notifications_sent`
Évite l'envoi de notifications en double en enregistrant:
- `user_id`: Utilisateur concerné
- `subscription_type`: 'platform' ou 'professor'
- `subscription_id`: ID de l'abonnement
- `professor_id`: ID du professeur (pour abonnements professeur)
- `days_before`: 7, 3, 1 ou 0
- `sent_at`: Date d'envoi

#### Fonction `check_and_send_expiration_notifications()`
Fonction PostgreSQL qui:
1. Vérifie tous les abonnements actifs expirant dans les 7 prochains jours
2. Calcule les jours restants avant expiration
3. Vérifie si une notification a déjà été envoyée pour ce seuil
4. Crée la notification appropriée
5. Enregistre l'envoi pour éviter les doublons

### 2. Edge Function

**Fonction**: `check-subscription-expiration`

Appelle la fonction PostgreSQL pour vérifier et envoyer les notifications.

**URL**: `https://{PROJECT_REF}.supabase.co/functions/v1/check-subscription-expiration`

**Méthode**: GET ou POST

**Authentification**: Aucune (fonction publique pour être appelée par cron)

### 3. Frontend

Les composants suivants ont été mis à jour:

- **`NotificationDropdown.tsx`**: Affiche les notifications dans le header
- **`Notifications.tsx`**: Page complète des notifications

Icônes utilisées:
- `Clock` (jaune): Abonnement expire bientôt
- `AlertTriangle` (rouge): Abonnement expiré

## Utilisation

### Option 1: Appel manuel (pour tester)

```bash
# Via curl
curl -X POST https://{PROJECT_REF}.supabase.co/functions/v1/check-subscription-expiration

# Via SQL directement
SELECT check_and_send_expiration_notifications();
```

### Option 2: Automatisation recommandée

#### A. Via un service cron externe (recommandé)

Configurer un service comme:
- **Cron-job.org** (gratuit)
- **EasyCron**
- **GitHub Actions**
- **Vercel Cron Jobs**

Exemple de configuration:
```yaml
# GitHub Actions (.github/workflows/check-subscriptions.yml)
name: Check Subscription Expirations
on:
  schedule:
    - cron: '0 9 * * *' # Tous les jours à 9h00 UTC
  workflow_dispatch: # Permet déclenchement manuel

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: Call Edge Function
        run: |
          curl -X POST https://{PROJECT_REF}.supabase.co/functions/v1/check-subscription-expiration
```

#### B. Via pg_cron (si disponible sur votre instance Supabase)

```sql
-- Exécuter tous les jours à 9h00
SELECT cron.schedule(
  'check-subscription-expiration',
  '0 9 * * *',
  'SELECT check_and_send_expiration_notifications()'
);
```

#### C. Via un worker Node.js

```javascript
// worker.js
import { CronJob } from 'cron';

const job = new CronJob(
  '0 9 * * *', // Tous les jours à 9h00
  async () => {
    try {
      const response = await fetch(
        'https://{PROJECT_REF}.supabase.co/functions/v1/check-subscription-expiration',
        { method: 'POST' }
      );
      console.log('Notifications checked:', await response.json());
    } catch (error) {
      console.error('Error checking notifications:', error);
    }
  },
  null,
  true,
  'Europe/Paris'
);

job.start();
```

### Option 3: Depuis l'interface admin

Vous pouvez ajouter un bouton dans votre page Admin pour déclencher manuellement la vérification:

```typescript
async function checkExpirations() {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-subscription-expiration`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      }
    }
  );

  const result = await response.json();
  console.log(result);
}
```

## Fréquence recommandée

**Une fois par jour à 9h00** (heure locale de vos utilisateurs principaux)

Pourquoi cette fréquence:
- Assez fréquent pour ne pas manquer les seuils de notification
- Pas trop fréquent pour éviter la surcharge
- Le matin permet aux utilisateurs de voir la notification pendant la journée

## Scénario d'utilisation typique

### Exemple: Utilisateur avec abonnement plateforme

1. **J-10**: Utilisateur souscrit à l'abonnement mensuel
2. **J+23** (7 jours avant expiration):
   - ✉️ Notification: "Votre abonnement expire dans 7 jours"
   - 🔔 Alerte dans le dropdown de notifications
   - Lien vers `/account` pour renouveler

3. **J+27** (3 jours avant):
   - ✉️ Notification: "Votre abonnement expire dans 3 jours"
   - 🟡 Urgence moyenne

4. **J+29** (1 jour avant):
   - ✉️ Notification: "Votre abonnement expire dans 1 jour"
   - 🔴 Urgence élevée

5. **J+30** (jour d'expiration):
   - ✉️ Notification: "Votre abonnement a expiré"
   - ❌ Accès restreint aux contenus premium

### Exemple: Utilisateur avec abonnement professeur

Même logique, mais:
- Lien vers `/professors/{professor_id}`
- Message mentionne le nom du professeur
- Concerne uniquement le contenu de ce professeur

## Prévention des doublons

Le système garantit qu'aucune notification en double n'est envoyée grâce à:

1. **Contrainte unique** dans `subscription_expiration_notifications_sent`:
   ```sql
   UNIQUE(user_id, subscription_type, subscription_id, days_before)
   ```

2. **Vérification avant insertion**:
   ```sql
   SELECT EXISTS(...) INTO already_sent;
   IF NOT already_sent THEN
     -- Créer notification
   END IF;
   ```

## Sécurité

- ✅ RLS activée sur toutes les tables
- ✅ Les utilisateurs ne peuvent voir que leurs propres notifications
- ✅ Seule la fonction système peut créer des notifications d'expiration
- ✅ La fonction utilise `SECURITY DEFINER` pour exécuter avec les permissions appropriées

## Maintenance

### Nettoyer l'historique des notifications envoyées

Si vous voulez nettoyer l'historique (par exemple, supprimer les enregistrements de plus de 1 an):

```sql
DELETE FROM subscription_expiration_notifications_sent
WHERE sent_at < now() - interval '1 year';
```

### Voir les statistiques

```sql
-- Nombre de notifications envoyées par type
SELECT
  subscription_type,
  days_before,
  COUNT(*) as total_sent
FROM subscription_expiration_notifications_sent
GROUP BY subscription_type, days_before
ORDER BY subscription_type, days_before DESC;

-- Utilisateurs avec abonnements expirant bientôt
SELECT
  p.email,
  p.platform_subscription_expires_at,
  EXTRACT(DAY FROM (p.platform_subscription_expires_at - now())) as days_until_expiry
FROM profiles p
WHERE p.platform_subscription_status = 'active'
  AND p.platform_subscription_expires_at IS NOT NULL
  AND p.platform_subscription_expires_at > now()
  AND p.platform_subscription_expires_at <= now() + interval '7 days'
ORDER BY p.platform_subscription_expires_at ASC;
```

## Tests

### 1. Test manuel avec SQL

```sql
-- Créer un abonnement qui expire dans 3 jours (pour tester)
UPDATE profiles
SET
  platform_subscription_status = 'active',
  platform_subscription_expires_at = now() + interval '3 days'
WHERE id = '{votre_user_id}';

-- Appeler la fonction
SELECT check_and_send_expiration_notifications();

-- Vérifier les notifications créées
SELECT * FROM notifications
WHERE user_id = '{votre_user_id}'
ORDER BY created_at DESC
LIMIT 5;
```

### 2. Test de l'Edge Function

```bash
curl -X POST https://{PROJECT_REF}.supabase.co/functions/v1/check-subscription-expiration
```

### 3. Test dans l'interface

1. Connectez-vous à l'application
2. Modifiez votre date d'expiration pour qu'elle soit dans 3 jours
3. Appelez la fonction manuellement
4. Vérifiez que la notification apparaît dans le dropdown et la page notifications

## Troubleshooting

### Aucune notification n'est créée

1. Vérifiez que des abonnements expirent dans les 7 prochains jours:
   ```sql
   SELECT * FROM profiles
   WHERE platform_subscription_expires_at BETWEEN now() AND now() + interval '7 days';
   ```

2. Vérifiez que la notification n'a pas déjà été envoyée:
   ```sql
   SELECT * FROM subscription_expiration_notifications_sent
   WHERE user_id = '{user_id}';
   ```

3. Vérifiez les logs de la fonction:
   ```sql
   SELECT check_and_send_expiration_notifications();
   ```

### Les notifications sont envoyées plusieurs fois

Vérifiez la contrainte unique:
```sql
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'subscription_expiration_notifications_sent';
```

### L'Edge Function ne répond pas

1. Vérifiez que la fonction est déployée
2. Vérifiez les logs dans le dashboard Supabase
3. Testez avec curl en ajoutant `-v` pour voir les détails

## Évolutions futures possibles

- ✨ Notifications par email (en plus des notifications in-app)
- ✨ Notifications push (pour une app mobile)
- ✨ Personnalisation des seuils de notification par utilisateur
- ✨ Rappels de renouvellement avec codes promo
- ✨ Statistiques d'efficacité des notifications (taux de renouvellement)

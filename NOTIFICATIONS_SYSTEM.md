# Système de Notifications

Date de création : 30 décembre 2024

---

## Vue d'ensemble

Le système de notifications permet aux étudiants de recevoir des alertes automatiques lorsque leurs professeurs favoris publient de nouveaux contenus (vidéos ou programmes).

---

## Fonctionnalités

### 1. Notifications Automatiques

Les notifications sont créées automatiquement via des triggers de base de données lorsque :
- Un professeur publie une nouvelle vidéo
- Un professeur publie un nouveau programme

**Critères d'envoi** :
- L'étudiant doit avoir ajouté le professeur en favoris
- Le contenu doit avoir une visibilité `public` ou `subscribers_only`
- Les notifications ne sont PAS envoyées pour les contenus `platform` (privés)

### 2. Types de Notifications

#### Nouvelle Vidéo
- **Type** : `new_video`
- **Titre** : "Nouvelle vidéo disponible"
- **Message** : "{nom_professeur} a publié une nouvelle vidéo : {titre_vidéo}"
- **Lien** : `/academy?video={video_id}`
- **Icône** : Vidéo (violet)

#### Nouveau Programme
- **Type** : `new_program`
- **Titre** : "Nouveau programme disponible"
- **Message** : "{nom_professeur} a publié un nouveau programme : {titre_programme}"
- **Lien** : `/academy?program={program_id}`
- **Icône** : Livre (vert)

### 3. Interface Utilisateur

#### Badge de Notifications
- Icône cloche dans le header
- Badge rouge avec le nombre de notifications non lues (max "9+")
- Visible uniquement pour les utilisateurs connectés

#### Dropdown
- Ouverture au clic sur l'icône
- Maximum 20 notifications récentes
- Actions disponibles :
  - Marquer toutes comme lues
  - Marquer une notification comme lue
  - Supprimer une notification
  - Cliquer pour accéder au contenu

#### Page Dédiée
Route : `/notifications`

**Fonctionnalités** :
- Affichage de toutes les notifications
- Filtres : "Toutes" / "Non lues"
- Actions en masse :
  - Marquer toutes comme lues
  - Supprimer toutes les notifications lues
- Affichage du temps relatif ("Il y a 5 min", "Il y a 2h")
- Indicateurs visuels pour les notifications non lues

---

## Architecture Technique

### Base de Données

#### Table `notifications`

```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  professor_id uuid REFERENCES professors(id) ON DELETE CASCADE,
  type text CHECK (type IN ('new_video', 'new_program')),
  title text NOT NULL,
  message text NOT NULL,
  link text NOT NULL,
  item_id uuid NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

#### Indexes

```sql
idx_notifications_user_id            -- Requêtes par utilisateur
idx_notifications_is_read            -- Filtrage par statut
idx_notifications_created_at         -- Tri chronologique
idx_notifications_user_unread        -- Comptage non lues (optimisé)
```

#### Politiques RLS

```sql
"Users can view own notifications"     -- SELECT pour l'utilisateur
"Users can mark own notifications as read" -- UPDATE pour l'utilisateur
"Users can delete own notifications"   -- DELETE pour l'utilisateur
```

### Triggers de Base de Données

#### Trigger : Nouvelle Vidéo

```sql
CREATE TRIGGER trigger_notify_new_video
  AFTER INSERT ON videos
  FOR EACH ROW
  EXECUTE FUNCTION notify_followers_new_video();
```

**Fonction** : `notify_followers_new_video()`
- Récupère le nom du professeur
- Insère une notification pour chaque follower
- Filtre par visibilité (public/subscribers_only uniquement)

#### Trigger : Nouveau Programme

```sql
CREATE TRIGGER trigger_notify_new_program
  AFTER INSERT ON programs
  FOR EACH ROW
  EXECUTE FUNCTION notify_followers_new_program();
```

**Fonction** : `notify_followers_new_program()`
- Récupère le nom du professeur
- Insère une notification pour chaque follower
- Filtre par visibilité (public/subscribers_only uniquement)

### Fonctions Utilitaires

#### `get_unread_notification_count(user_id)`
Retourne le nombre de notifications non lues pour un utilisateur.

#### `mark_all_notifications_read(user_id)`
Marque toutes les notifications d'un utilisateur comme lues.

---

## Composants Frontend

### 1. NotificationDropdown
**Fichier** : `src/components/NotificationDropdown.tsx`

**Props** : Aucune (utilise les contextes)

**Fonctionnalités** :
- Affichage du badge avec compteur
- Dropdown avec liste des notifications
- Real-time updates via Supabase subscriptions
- Actions : marquer comme lu, supprimer
- Toast notifications pour les nouvelles notifications

**Hooks utilisés** :
- `useAuth()` - Récupération de l'utilisateur
- `useToast()` - Affichage des messages

### 2. NotificationsPage
**Fichier** : `src/pages/Notifications.tsx`

**Props** :
- `onNavigate(page: string)` - Navigation

**Fonctionnalités** :
- Page complète dédiée aux notifications
- Filtrage (toutes/non lues)
- Actions en masse
- Affichage enrichi avec icônes par type
- Formatage du temps relatif

---

## Flux de Données

### 1. Création d'une Notification

```
1. Professeur crée vidéo/programme
   ↓
2. INSERT dans table videos/programs
   ↓
3. Trigger AFTER INSERT s'exécute
   ↓
4. Fonction récupère les followers du professeur
   ↓
5. INSERT des notifications pour chaque follower
   ↓
6. Notification push via Realtime (Supabase)
   ↓
7. Frontend reçoit la notification
   ↓
8. Mise à jour du compteur + Toast
```

### 2. Consultation d'une Notification

```
1. Utilisateur clique sur notification
   ↓
2. Si non lue → UPDATE is_read = true
   ↓
3. Navigation vers le contenu (via link)
   ↓
4. Mise à jour du compteur frontend
```

### 3. Suppression d'une Notification

```
1. Utilisateur clique sur "Supprimer"
   ↓
2. DELETE de la notification
   ↓
3. Mise à jour de l'état local (filtrage)
   ↓
4. Mise à jour du compteur si non lue
```

---

## Sécurité

### Row Level Security (RLS)

✅ **Toutes les politiques respectent les principes suivants** :
1. Les utilisateurs ne peuvent voir que leurs propres notifications
2. Seuls les triggers peuvent créer des notifications (pas d'INSERT user)
3. Les utilisateurs ne peuvent modifier que leurs propres notifications
4. Vérification systématique de `auth.uid() = user_id`

### Validation des Données

✅ **Contraintes de base de données** :
- Type de notification limité à 2 valeurs (`new_video`, `new_program`)
- Références foreign key pour intégrité
- Champs NOT NULL pour données critiques
- Cascade DELETE pour nettoyage automatique

---

## Performance

### Optimisations

1. **Indexes Composés**
   - `idx_notifications_user_unread` : Comptage rapide des non lues
   - Requête optimisée avec `WHERE` clause indexée

2. **Limit des Requêtes**
   - Dropdown : 20 notifications max
   - Page complète : Pas de limite (scroll infini possible)

3. **Realtime Subscriptions**
   - Souscription uniquement pour l'utilisateur courant
   - Filter côté serveur : `user_id=eq.{user.id}`
   - Réduit le trafic réseau

4. **Cleanup Automatique**
   - Cascade DELETE si utilisateur supprimé
   - Cascade DELETE si professeur supprimé
   - Nettoyage manuel possible par l'utilisateur

---

## Utilisation

### Pour les Étudiants

1. **Activer les Notifications**
   - Ajouter un professeur en favoris (bouton cœur)
   - Les notifications seront automatiquement créées

2. **Consulter les Notifications**
   - Cliquer sur l'icône cloche dans le header
   - Ou accéder à `/notifications` pour la vue complète

3. **Gérer les Notifications**
   - Marquer comme lues individuellement
   - Marquer toutes comme lues
   - Supprimer individuellement
   - Supprimer toutes les lues

### Pour les Professeurs

1. **Déclencher des Notifications**
   - Publier une nouvelle vidéo (visibilité public/subscribers_only)
   - Publier un nouveau programme (visibilité public/subscribers_only)

2. **Notifications Envoyées À**
   - Tous les étudiants ayant ce professeur en favoris
   - Nombre affiché lors de la création (futur)

---

## Limitations & Améliorations Futures

### Limitations Actuelles

1. Pas de notifications push (navigateur)
2. Pas de notifications email
3. Pas de préférences utilisateur (désactiver certains types)
4. Pas de historique de suppression
5. Pas de statistiques pour les professeurs

### Améliorations Possibles

#### Court Terme
- [ ] Ajouter notifications push (Web Push API)
- [ ] Ajouter son de notification
- [ ] Grouper les notifications par professeur
- [ ] Marquer comme lu au survol

#### Moyen Terme
- [ ] Notifications email (digest quotidien/hebdomadaire)
- [ ] Préférences utilisateur (types, fréquence)
- [ ] Statistiques pour professeurs (taux d'ouverture)
- [ ] Notifications pour événements

#### Long Terme
- [ ] Notifications SMS (Twilio)
- [ ] Notifications in-app personnalisées
- [ ] Machine learning pour timing optimal
- [ ] Notifications de rappel (cours non terminés)

---

## Dépannage

### Pas de Notifications Reçues

**Vérifier** :
1. Le professeur est-il en favoris ?
2. La visibilité du contenu est-elle `public` ou `subscribers_only` ?
3. Le trigger est-il activé ?
4. Les politiques RLS sont-elles correctes ?

**Debug** :
```sql
-- Vérifier les triggers
SELECT * FROM pg_trigger WHERE tgname LIKE '%notify%';

-- Vérifier les notifications créées
SELECT * FROM notifications WHERE user_id = 'USER_ID';

-- Vérifier les favoris
SELECT * FROM favorites WHERE user_id = 'USER_ID' AND item_type = 'professor';
```

### Notifications en Double

**Cause possible** : Trigger exécuté plusieurs fois

**Solution** :
```sql
-- Vérifier les triggers dupliqués
SELECT * FROM pg_trigger WHERE tgrelid = 'videos'::regclass;

-- Supprimer les doublons si nécessaire
DROP TRIGGER trigger_notify_new_video ON videos;
```

### Compteur Incorrect

**Cause possible** : État local désynchronisé

**Solution** :
- Recharger la page
- Vérifier la console pour erreurs
- Vérifier les politiques RLS

---

## Tests

### Tests Manuels

#### Test 1 : Notification Vidéo
1. Étudiant ajoute Professeur A en favoris
2. Professeur A crée une vidéo publique
3. ✅ Étudiant reçoit notification
4. ✅ Compteur s'incrémente
5. ✅ Toast s'affiche

#### Test 2 : Pas de Notification (Contenu Privé)
1. Étudiant ajoute Professeur B en favoris
2. Professeur B crée une vidéo `platform` (privée)
3. ✅ Étudiant ne reçoit PAS de notification

#### Test 3 : Pas de Notification (Pas en Favoris)
1. Professeur C crée une vidéo publique
2. Étudiant n'a PAS Professeur C en favoris
3. ✅ Étudiant ne reçoit PAS de notification

#### Test 4 : Marquer Comme Lu
1. Étudiant clique sur notification
2. ✅ Notification marquée comme lue
3. ✅ Compteur décrémente
4. ✅ Navigation vers le contenu

### Tests Automatisés

**À implémenter** :
```typescript
describe('Notifications System', () => {
  it('should create notification when professor posts video', async () => {
    // Test trigger
  });

  it('should not notify if not in favorites', async () => {
    // Test favoris requis
  });

  it('should update unread count correctly', async () => {
    // Test compteur
  });
});
```

---

## Métriques

### Métriques à Suivre

1. **Engagement**
   - Taux d'ouverture des notifications
   - Temps moyen avant consultation
   - Taux de suppression sans lecture

2. **Volume**
   - Nombre de notifications créées par jour
   - Nombre de notifications par utilisateur
   - Distribution par type (vidéo/programme)

3. **Performance**
   - Temps de création d'une notification
   - Temps de chargement du dropdown
   - Latence Realtime

---

## Conclusion

Le système de notifications est maintenant pleinement opérationnel et offre :

✅ Notifications automatiques pour les nouveaux contenus
✅ Interface utilisateur intuitive et réactive
✅ Sécurité robuste avec RLS
✅ Performance optimisée avec indexes
✅ Expérience temps réel avec Supabase Realtime

**Prochaines étapes recommandées** :
1. Implémenter les tests automatisés
2. Ajouter les notifications push navigateur
3. Créer un dashboard pour les professeurs
4. Collecter des métriques d'engagement

---

**Version** : 1.0
**Date de mise à jour** : 30 décembre 2024
**Statut** : ✅ Production Ready

# Gestion des Changements de Prix d'Abonnement

## 🎯 Vue d'ensemble

Ce document explique comment le système réagit lorsqu'un professeur modifie le prix de son abonnement, et comment les abonnés existants sont protégés.

## 💰 Protection des Prix - "Grandfathering"

### Principe Fondamental

**Les abonnés existants gardent TOUJOURS leur prix original, même si le professeur augmente ses tarifs.**

Cette politique de "grandfathering" garantit :
- ✅ Protection des abonnés fidèles
- ✅ Transparence et confiance
- ✅ Conformité avec les meilleures pratiques Stripe
- ✅ Expérience utilisateur prévisible

---

## 🔄 Scénarios de Changement de Prix

### Scénario 1 : Augmentation de Prix

**Situation :**
- Professeur augmente son prix de 10€/mois → 15€/mois
- 5 personnes sont déjà abonnées à 10€/mois

**Comportement du système :**

| Utilisateur | Statut | Prix payé | Explication |
|-------------|--------|-----------|-------------|
| Alice | Abonnée depuis 6 mois | **10€/mois** | Garde son prix original (grandfathering) |
| Bob | Abonné depuis 3 mois | **10€/mois** | Garde son prix original (grandfathering) |
| Charlie | Abonné depuis 1 an | **10€/mois** | Garde son prix original (grandfathering) |
| David | Abonné depuis 2 semaines | **10€/mois** | Garde son prix original (grandfathering) |
| Emma | Abonnée depuis 1 mois | **10€/mois** | Garde son prix original (grandfathering) |
| **François** | **Nouveau** | **15€/mois** | Paie le nouveau prix |

**🔒 Garantie : Les 5 abonnés existants continueront à payer 10€/mois indéfiniment, tant qu'ils ne se désabonnent pas.**

---

### Scénario 2 : Baisse de Prix

**Situation :**
- Professeur baisse son prix de 15€/mois → 10€/mois
- 3 personnes sont abonnées à 15€/mois

**Comportement du système :**

| Utilisateur | Statut | Prix payé | Explication |
|-------------|--------|-----------|-------------|
| Alice | Abonnée à l'ancien prix | **15€/mois** | Continue à payer 15€ (prix original) |
| Bob | Abonné à l'ancien prix | **15€/mois** | Continue à payer 15€ (prix original) |
| Charlie | Abonné à l'ancien prix | **15€/mois** | Continue à payer 15€ (prix original) |
| **David** | **Nouveau** | **10€/mois** | Paie le nouveau prix réduit |

**💡 Note :** Dans ce cas, les anciens abonnés paient PLUS que les nouveaux. C'est volontaire - Stripe ne permet pas de modifier automatiquement le prix d'abonnements existants.

**Solution pour les abonnés :** Un utilisateur peut se désabonner et se réabonner pour bénéficier du prix réduit (l'UI devrait proposer cette option).

---

### Scénario 3 : Multiples Changements de Prix

**Situation :**
- Mois 1 : Prix à 10€
- Mois 3 : Prix augmente à 15€
- Mois 6 : Prix augmente à 20€

**Abonnés actifs :**

| Utilisateur | Abonné en | Prix payé | Explication |
|-------------|-----------|-----------|-------------|
| Alice | Mois 1 | **10€/mois** | Garde le prix de son inscription |
| Bob | Mois 1 | **10€/mois** | Garde le prix de son inscription |
| Charlie | Mois 4 | **15€/mois** | Garde le prix de son inscription |
| David | Mois 5 | **15€/mois** | Garde le prix de son inscription |
| Emma | Mois 7 | **20€/mois** | Paie le prix actuel |

**📊 Résultat :** Chaque utilisateur paie le prix qui était en vigueur au moment de son inscription, créant plusieurs "tiers" de prix.

---

## 🛠️ Implémentation Technique

### 1. Stockage du Prix Payé

**Colonnes ajoutées :**

```sql
-- Pour les abonnements de professeurs
professor_subscriptions.price_paid (decimal)

-- Pour les abonnements plateforme
profiles.platform_subscription_price_paid (decimal)
```

### 2. Flux de Données

```
┌─────────────────┐
│  Professeur     │
│  Change Prix    │
│  10€ → 15€      │
└────────┬────────┘
         │
         │ ❌ N'affecte PAS les abonnés existants
         │
         ▼
┌─────────────────────────────────────────┐
│           Stripe Subscriptions           │
│  • Alice: 10€ (price_id_old)            │
│  • Bob: 10€ (price_id_old)              │
│  • Charlie: 10€ (price_id_old)          │
└─────────────────────────────────────────┘
         │
         │ ✅ Nouveaux abonnés seulement
         │
         ▼
┌─────────────────────────────────────────┐
│        François (Nouveau)                │
│        Paie 15€ (price_id_new)          │
└─────────────────────────────────────────┘
```

### 3. Code Webhook

Le webhook Stripe enregistre automatiquement le prix au moment de la souscription :

```typescript
// Lors de la création d'un abonnement
const priceAmount = subscription.items.data[0]?.price.unit_amount || 0;
const pricePaid = priceAmount / 100; // Stripe utilise des centimes

// Stockage permanent du prix
await supabase.from("professor_subscriptions").insert({
  user_id: userId,
  professor_id: professorId,
  price_paid: pricePaid, // ← Prix figé, jamais modifié
  stripe_subscription_id: subscription.id,
  status: "active"
});
```

**🔑 Point clé :** `price_paid` est écrit UNE SEULE FOIS lors de la création de l'abonnement, et n'est JAMAIS mis à jour.

---

## 📊 Exemples Concrets

### Affichage dans l'UI Utilisateur

**Cas 1 : Utilisateur abonné à l'ancien prix**

```
┌──────────────────────────────────────┐
│  Abonnement Professeur Kizomba      │
│                                       │
│  Votre prix : 10€/mois               │
│  Prix actuel : 15€/mois              │
│                                       │
│  💰 Vous économisez 5€/mois !        │
│                                       │
│  ✅ Votre prix est garanti tant      │
│     que vous restez abonné           │
└──────────────────────────────────────┘
```

**Cas 2 : Utilisateur abonné à l'ancien prix (prix a baissé)**

```
┌──────────────────────────────────────┐
│  Abonnement Professeur Kizomba      │
│                                       │
│  Votre prix : 15€/mois               │
│  Prix actuel : 10€/mois              │
│                                       │
│  💡 Voulez-vous profiter du          │
│     nouveau prix réduit ?            │
│                                       │
│  [Se réabonner au nouveau prix]      │
└──────────────────────────────────────┘
```

### Affichage pour le Professeur

```
┌──────────────────────────────────────────────┐
│  Mes Abonnés - Répartition par Prix          │
│                                               │
│  Total : 12 abonnés actifs                   │
│                                               │
│  • 5 abonnés à 10€/mois (anciens)           │
│  • 4 abonnés à 15€/mois (moyens)            │
│  • 3 abonnés à 20€/mois (actuels)           │
│                                               │
│  Revenu mensuel : 185€                       │
│  Prix actuel : 20€/mois                      │
└──────────────────────────────────────────────┘
```

---

## 🚨 Points d'Attention

### 1. Désabonnement = Perte du Prix Privilégié

⚠️ **IMPORTANT :** Si un utilisateur se désabonne, il perd son prix privilégié définitivement.

**Exemple :**
- Alice est abonnée à 10€/mois depuis 1 an
- Le prix actuel est 20€/mois
- Alice se désabonne
- **Si Alice se réabonne**, elle paiera 20€/mois (le prix actuel)

**💡 Solution UI :** Afficher un avertissement avant de confirmer le désabonnement.

### 2. Pas de Mise à Jour Automatique

Le système ne peut PAS :
- ❌ Augmenter automatiquement les prix existants
- ❌ Diminuer automatiquement les prix existants
- ❌ Forcer une migration de prix

Ces opérations nécessitent l'accord explicite de l'utilisateur via Stripe.

### 3. Historique de Prix

Chaque abonnement conserve son `price_paid` :
- ✅ Permet d'afficher "Vous payez X€/mois"
- ✅ Permet des rapports financiers précis
- ✅ Permet de détecter les "early supporters"
- ✅ Permet des offres spéciales ciblées

---

## 🔍 Requêtes Utiles

### Trouver les "Early Supporters"

```sql
-- Abonnés qui paient moins que le prix actuel
SELECT
  p.email,
  ps.price_paid,
  prof.subscription_price as current_price,
  (prof.subscription_price - ps.price_paid) as savings
FROM professor_subscriptions ps
JOIN profiles p ON p.id = ps.user_id
JOIN professors prof ON prof.id = ps.professor_id
WHERE ps.status = 'active'
  AND ps.price_paid < prof.subscription_price
ORDER BY savings DESC;
```

### Analyser la Répartition des Prix

```sql
-- Distribution des abonnés par prix payé
SELECT
  prof.id as professor_id,
  ps.price_paid,
  COUNT(*) as subscriber_count,
  SUM(ps.price_paid) as monthly_revenue
FROM professor_subscriptions ps
JOIN professors prof ON prof.id = ps.professor_id
WHERE ps.status = 'active'
GROUP BY prof.id, ps.price_paid
ORDER BY prof.id, ps.price_paid;
```

---

## ✅ Résumé

| Question | Réponse |
|----------|---------|
| Un prof augmente son prix. Les abonnés existants sont affectés ? | ❌ **NON** - Ils gardent leur prix |
| Un prof baisse son prix. Les abonnés existants payent moins ? | ❌ **NON** - Ils gardent leur prix |
| Un utilisateur se désabonne puis se réabonne. Quel prix ? | Le prix **actuel** au moment du réabonnement |
| Peut-on forcer un changement de prix pour tous ? | ❌ **NON** - Impossible sans l'accord utilisateur |
| Le système stocke-t-il le prix de chaque abonné ? | ✅ **OUI** - Dans `price_paid` |
| Un prof peut voir qui paie quel prix ? | ✅ **OUI** - Dashboard prévu |

---

## 📞 Support

Pour toute question sur la gestion des prix :
1. Consultez la documentation Stripe sur les subscriptions
2. Vérifiez les logs du webhook `stripe-webhook`
3. Inspectez la colonne `price_paid` en base de données

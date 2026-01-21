# Gestion des Prix d'Abonnement des Professeurs

## Vue d'ensemble

Le système permet à chaque professeur de définir son propre prix d'abonnement mensuel. Les prix sont gérés dynamiquement via Stripe sans nécessiter de créer des produits manuellement pour chaque professeur.

## Comment ça fonctionne

### 1. Prix stocké en base de données

Chaque professeur a un champ `subscription_price` (décimal) dans la table `professors` :

```sql
CREATE TABLE professors (
  id uuid PRIMARY KEY,
  subscription_price decimal(10,2) DEFAULT 0,
  ...
);
```

### 2. Création dynamique du prix Stripe

Lors du checkout, au lieu d'utiliser un Price ID fixe, le système utilise `price_data` pour créer le prix à la volée :

```typescript
{
  price_data: {
    currency: "eur",
    unit_amount: Math.round(price * 100), // Prix du professeur en centimes
    recurring: {
      interval: "month",
    },
    product_data: {
      name: `Monthly subscription to ${professorName}`,
      metadata: {
        professor_id: professorId,
      },
    },
  },
  quantity: 1,
}
```

### 3. Processus d'abonnement

1. **L'utilisateur clique sur "S'abonner"** sur la page du professeur
2. **Le système récupère** le prix depuis la base de données (`professor.subscription_price`)
3. **Un checkout Stripe est créé** avec le prix dynamique
4. **L'utilisateur paie** via Stripe Checkout
5. **Le webhook confirme** le paiement et crée l'abonnement dans `professor_subscriptions`
6. **Renouvellement automatique** chaque mois via Stripe

## Avantages de cette approche

✅ **Flexibilité totale** - Chaque professeur peut avoir son propre tarif
✅ **Pas de configuration Stripe** - Pas besoin de créer des produits manuellement
✅ **Changement instantané** - Modifier le prix dans l'admin l'applique immédiatement
✅ **Gestion complète** - Annulation, renouvellement, échecs de paiement gérés par Stripe
✅ **Simplicité** - Un seul système pour tous les professeurs

## Modifier le prix d'un professeur

### Via le Dashboard Professeur (Recommandé)

1. Connectez-vous en tant que professeur
2. Allez dans "Professor Dashboard" → "Paramètres"
3. Dans la section "Prix d'Abonnement Mensuel", entrez votre tarif
4. Mettez **0€** pour rendre tout votre contenu gratuit (accessible sans abonnement)
5. Cliquez sur "Enregistrer le prix"

Le nouveau prix s'applique immédiatement aux nouveaux abonnements.

### Via l'interface admin

1. Connectez-vous en tant qu'admin
2. Allez dans "Admin Panel" → "Professors Management"
3. Trouvez le professeur concerné
4. Modifiez le champ "Subscription Price"
5. Cliquez sur "Update"

Le nouveau prix s'applique immédiatement aux nouveaux abonnements. Les abonnements existants continuent au prix d'origine jusqu'à leur renouvellement.

### Via SQL (si nécessaire)

```sql
UPDATE professors
SET subscription_price = 15.99
WHERE id = 'professor-uuid-here';
```

## Structure de la base de données

### Table `professors`
```sql
- id (uuid)
- subscription_price (decimal) -- Prix mensuel en euros
- subscriber_discount_percentage (integer) -- Réduction pour les abonnés platform
```

### Table `professor_subscriptions`
```sql
- id (uuid)
- user_id (uuid) -- L'utilisateur abonné
- professor_id (uuid) -- Le professeur
- stripe_subscription_id (text) -- ID Stripe pour la gestion
- status (text) -- active, canceled, expired
- current_period_end (timestamptz) -- Date de fin de la période actuelle
- cancel_at_period_end (boolean) -- Si l'abonnement sera annulé
```

## Webhooks Stripe

Les événements suivants mettent à jour automatiquement les abonnements :

- `customer.subscription.created` - Nouvel abonnement créé
- `customer.subscription.updated` - Abonnement modifié (renouvellement)
- `customer.subscription.deleted` - Abonnement expiré ou supprimé
- `invoice.payment_succeeded` - Paiement réussi (renouvellement)
- `invoice.payment_failed` - Échec de paiement

## Différence avec l'abonnement Platform

| Aspect | Abonnement Platform | Abonnement Professeur |
|--------|--------------------|-----------------------|
| Prix | Fixe (8.99€ ou 89€) | Variable par professeur |
| Stripe | Price ID requis | Prix dynamique |
| Configuration | Manuelle dans Stripe | Automatique |
| Fréquence | Mensuel ou Annuel | Mensuel uniquement |

## Contenu Gratuit vs Payant

Les professeurs ont deux options :

### Prix à 0€ (Gratuit)
- Tout le contenu "Réservé aux abonnés" devient accessible sans paiement
- Idéal pour partager gratuitement ses cours
- Aucune barrière payante pour les élèves
- Les programmes payants restent payants (non affectés)

### Prix > 0€ (Abonnement payant)
- Le contenu "Réservé aux abonnés" nécessite un abonnement actif
- Les élèves paient mensuellement le tarif défini
- Renouvellement automatique via Stripe
- Les programmes payants peuvent offrir une réduction aux abonnés

## Questions fréquentes

**Q: Que se passe-t-il si je change le prix d'un professeur ?**
R: Les nouveaux abonnements utilisent le nouveau prix. Les abonnements existants gardent leur prix d'origine.

**Q: Puis-je voir l'historique des prix ?**
R: Stripe conserve l'historique dans les métadonnées des subscriptions, mais ce n'est pas affiché dans l'interface.

**Q: Peut-on avoir des abonnements annuels pour les professeurs ?**
R: Actuellement non, mais cela peut être ajouté en modifiant le paramètre `recurring.interval` dans l'edge function.

**Q: Les professeurs peuvent-ils gérer eux-mêmes leur prix ?**
R: Oui ! Depuis la section "Paramètres" de leur dashboard, ils peuvent modifier leur prix d'abonnement à tout moment.

## Code source concerné

- `/supabase/functions/create-stripe-checkout/index.ts` - Création du checkout avec prix dynamique
- `/src/lib/stripe.ts` - Fonction `handleProfessorSubscriptionCheckout()`
- `/src/pages/ProfessorDetail.tsx` - Interface utilisateur d'abonnement
- `/src/pages/Account.tsx` - Gestion des abonnements actifs

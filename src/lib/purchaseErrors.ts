// Erreurs du parcours d'achat (serveur ou application) traduites côté front.
// Les fonctions serveur renvoient des messages en français ou en anglais : on
// les reconnaît ici et on affiche la clé du dictionnaire de la langue active.
// Message inconnu → message générique traduit (jamais de texte technique brut).
type Translate = (key: string, params?: Record<string, string | number>) => string;

interface ErrorRule {
  match: (string | RegExp)[] | RegExp;
  key: string;
  /** Noms des paramètres, dans l'ordre des groupes capturés par l'expression. */
  params?: string[];
}

const RULES: ErrorRule[] = [
  { match: ['Vous devez être connecté pour passer commande', 'You must be signed in to proceed with checkout', 'Authentication required', 'Unauthorized', 'No authorization header'], key: 'purchaseError.signInRequired' },
  { match: ['Votre session a expiré. Veuillez vous reconnecter.', 'Invalid or expired session. Please sign in again.'], key: 'purchaseError.sessionExpired' },
  { match: /^Rate limit exceeded/, key: 'purchaseError.rateLimited' },
  { match: /^Insufficient stock for product (.+)\. Only (\d+) available\.$/, key: 'purchaseError.productStock', params: ['name', 'count'] },
  { match: /^Insufficient tickets available\. Only (\d+) left\.$/, key: 'purchaseError.ticketsLeft', params: ['count'] },
  { match: ["Ce billet n'est plus disponible à la vente."], key: 'purchaseError.ticketUnavailable' },
  { match: ["Impossible de déterminer le tarif actuel de ce billet. Actualise la page.", 'Impossible de déterminer le tarif actuel.'], key: 'purchaseError.priceUnknown' },
  { match: ['Aucun tarif actif pour ce billet. Contacte le support.'], key: 'purchaseError.noActivePrice' },
  { match: ['Un seul Price Lock est autorisé par festival.', 'Tu as déjà un Price Lock pour ce festival. Un seul Price Lock est autorisé par festival.'], key: 'purchaseError.onePriceLockPerFestival' },
  { match: ['Un Price Lock est toujours limité à une quantité de 1.'], key: 'purchaseError.priceLockQuantity' },
  { match: ['Price Lock non disponible pour ce billet.'], key: 'purchaseError.priceLockUnavailable' },
  { match: ['Aucune hausse tarifaire programmée pour ce billet.'], key: 'purchaseError.noPriceIncrease' },
  { match: ["Le Price Lock n'est pas encore ouvert pour ce billet."], key: 'purchaseError.priceLockNotOpen' },
  { match: ["Ce Price Lock n'est plus disponible pour ce tarif.", 'Price Lock fermé pour ce billet : la hausse est déjà passée.'], key: 'purchaseError.priceLockClosed' },
  { match: ['Ventes closes pour ce billet.'], key: 'purchaseError.salesClosed' },
  { match: ['Tu as déjà un Price Lock actif pour ce billet.'], key: 'purchaseError.priceLockActiveTicket' },
  { match: ['Tu as déjà un Price Lock actif pour ce festival.'], key: 'purchaseError.priceLockActiveFestival' },
  { match: ['Maximum 2 Price Locks actifs simultanément.'], key: 'purchaseError.priceLockMax' },
  { match: ['Montant de versement Price Lock invalide.', "Le versement choisi n'est pas valide pour ce Price Lock."], key: 'purchaseError.depositInvalid' },
  { match: ['Le dépôt Price Lock doit être inférieur au tarif actuel.'], key: 'purchaseError.depositTooHigh' },
  { match: ['Quota Price Lock épuisé pour ce billet.'], key: 'purchaseError.priceLockQuota' },
  { match: ["Le tarif de ce billet a évolué depuis l'ajout au panier."], key: 'purchaseError.priceChangedShort' },
  { match: ['Shipping address is required for physical products'], key: 'purchaseError.shippingRequired' },
  { match: /^shipping_info\./, key: 'purchaseError.contactInvalid' },
  { match: ['Failed to reserve stock. Please try again.'], key: 'purchaseError.stockReservationFailed' },
  { match: ['Commande introuvable.'], key: 'purchaseError.orderNotFound' },
  { match: ["Cette commande n'est plus en attente de paiement."], key: 'purchaseError.orderNotPending' },
  { match: ['Cette commande a expiré. Recommence ta commande.'], key: 'purchaseError.orderExpired' },
  { match: ['Commande vide.', 'Aucun article payant dans cette commande.'], key: 'purchaseError.orderEmpty' },
  { match: ['Montant de la commande incohérent. Recommence ta commande.'], key: 'purchaseError.orderAmountMismatch' },
  { match: ['Failed to create order', 'Failed to create order items', 'Erreur lors de la création de la commande', 'Aucune réponse reçue de la validation de commande'], key: 'purchaseError.orderFailed' },
  { match: [/^Configuration Stripe invalide/, /^Payment system not configured/, 'Failed to create checkout session', 'No checkout URL received', 'Paiement impossible.'], key: 'purchaseError.paymentUnavailable' },
  // Paiement du solde et rachat d'un Price Lock (Mes Pass).
  { match: ['Vous devez être connecté.'], key: 'purchaseError.signInRequired' },
  { match: ['Price Lock introuvable.', 'Ce Price Lock ne vous appartient pas.'], key: 'purchaseError.lockNotFound' },
  { match: ["Ce Price Lock n'est plus actif."], key: 'purchaseError.lockNotActive' },
  { match: ["Ce Price Lock a expiré : ton ancien tarif n'est plus garanti."], key: 'purchaseError.lockExpired' },
  { match: ['Le prélèvement automatique de ce solde est en cours. Réessaie dans quelques minutes.'], key: 'purchaseError.autoInProgress' },
  { match: ['Cet événement a été annulé : le solde ne peut plus être payé.', 'Cet événement a été annulé : aucun paiement ne peut être enregistré'], key: 'purchaseError.eventCancelled' },
  { match: ['Aucun solde restant sur ce Price Lock.'], key: 'purchaseError.noBalance' },
  { match: ["Ce Price Lock n'est pas expiré."], key: 'purchaseError.lockNotExpired' },
  { match: ['Le versement de ce Price Lock a déjà été utilisé.'], key: 'purchaseError.creditConsumed' },
  { match: ['Le versement de ce Price Lock a été remboursé.'], key: 'purchaseError.creditRefunded' },
  { match: ['Les ventes de ce pass sont terminées.'], key: 'purchaseError.passSalesClosed' },
  { match: ['Ce pass est complet pour le moment.'], key: 'myPasses.repurchase.soldOut' },
  { match: ["Ce pass n'est plus disponible à la vente."], key: 'purchaseError.passUnavailable' },
  { match: ['Contacte-nous pour finaliser ton pass.'], key: 'myPasses.repurchase.contactUs' },
  { match: ['Achat impossible pour ce Price Lock.'], key: 'purchaseError.repurchaseImpossible' },
  { match: ['Impossible de démarrer le paiement du solde.', 'Impossible de démarrer le paiement.'], key: 'purchaseError.paymentStart' },
];

// Apostrophes typographiques et espaces normalisés avant comparaison.
const normalize = (message: string) => message.replace(/[\u2019\u2018]/g, "'").replace(/\s+/g, ' ').trim();

export function purchaseErrorMessage(error: unknown, t: Translate, fallbackKey = 'purchaseError.generic'): string {
  const raw = typeof error === 'string' ? error : (error as { message?: unknown } | null)?.message;
  const message = typeof raw === 'string' ? normalize(raw) : '';
  if (message) {
    for (const rule of RULES) {
      const patterns = Array.isArray(rule.match) ? rule.match : [rule.match];
      for (const pattern of patterns) {
        if (typeof pattern === 'string') {
          if (normalize(pattern) === message) return t(rule.key);
          continue;
        }
        const found = message.match(pattern);
        if (found) {
          const params = Object.fromEntries((rule.params ?? []).map((name, i) => [name, found[i + 1] ?? '']));
          return t(rule.key, params);
        }
      }
    }
  }
  return t(fallbackKey);
}

/** Paiement du solde / rachat d'un Price Lock : repli « paiement non démarré ». */
export const priceLockErrorMessage = (error: unknown, t: Translate): string =>
  purchaseErrorMessage(error, t, 'purchaseError.paymentStart');

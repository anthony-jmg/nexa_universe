/**
 * Création d'un Price Lock APRÈS confirmation réelle du paiement.
 *
 * Réutilise exclusivement les règles backend existantes :
 * - l'insertion `price_locks` déclenche `enforce_price_lock_rules`
 *   (photographie du prix, fenêtre, quota, limites par utilisateur) ;
 * - `record_price_lock_payment` est idempotent via l'identifiant Stripe.
 *
 * Le lock n'est JAMAIS créé parce que l'utilisateur a ouvert la page de
 * paiement : uniquement après un paiement confirmé (webhook ou verify).
 */

interface CreateLockResult {
  lockId?: string;
  alreadyExists?: boolean;
  error?: string;
}

export async function createPriceLockAfterPayment(
  supabase: any,
  userId: string,
  ticketTypeId: string,
  paymentIntentId: string | null,
  depositAmount: number
): Promise<CreateLockResult> {
  if (!ticketTypeId) return { error: 'Billet introuvable' };

  // Un paiement déjà rattaché à un lock ? -> idempotence : rien à faire
  if (paymentIntentId) {
    const { data: existingPayment } = await supabase
      .from("stripe_payments")
      .select("id, price_lock_id")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle();

    if (existingPayment?.price_lock_id) {
      return { lockId: existingPayment.price_lock_id, alreadyExists: true };
    }
  }

  // Lock actif déjà existant pour cet utilisateur + ce billet ?
  const { data: activeLock } = await supabase
    .from("price_locks")
    .select("id")
    .eq("user_id", userId)
    .eq("event_ticket_type_id", ticketTypeId)
    .eq("status", "active")
    .maybeSingle();

  if (activeLock) {
    // Paiement rattaché au lock existant (ex: rechargement de la page de retour)
    if (paymentIntentId) {
      await supabase
        .from("stripe_payments")
        .update({ price_lock_id: activeLock.id })
        .eq("stripe_payment_intent_id", paymentIntentId)
        .is("price_lock_id", null);
    }
    return { lockId: activeLock.id, alreadyExists: true };
  }

  // Création : le trigger applicque et protège toutes les règles métier.
  // Le montant choisi par l'utilisateur (revalidé par le checkout) est transmis
  // via selected_deposit_amount ; le trigger le valide une seconde fois côté
  // base et calcule deposit/total_paid/remaining. Sans montant (flux historique),
  // le trigger applique le dépôt fixe configuré sur le billet.
  const insertPayload: Record<string, unknown> = {
    user_id: userId,
    event_ticket_type_id: ticketTypeId,
  };
  if (Number.isFinite(depositAmount) && depositAmount > 0) {
    insertPayload.selected_deposit_amount = depositAmount;
  }

  const { data: lock, error: insertError } = await supabase
    .from("price_locks")
    .insert(insertPayload)
    .select()
    .single();

  if (insertError) {
    return { error: insertError.message || 'Impossible de créer le Price Lock.' };
  }

  // Rattache le paiement au lock de façon idempotente
  if (paymentIntentId) {
    await supabase
      .from("stripe_payments")
      .update({ price_lock_id: lock.id })
      .eq("stripe_payment_intent_id", paymentIntentId)
      .is("price_lock_id", null);
  }

  return { lockId: lock.id };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const AUTO_DEBIT_LEAD_DAYS = 3;

/**
 * Date du prélèvement automatique du solde : 3 jours avant l'expiration du
 * lock, pour laisser le temps de régler manuellement si le débit échoue.
 * Si l'expiration est trop proche, on prélève à mi-chemin (jamais après).
 */
export function computeAutoDebitAt(expiresAt: string | Date, now: Date = new Date()): Date {
  const expires = new Date(expiresAt).getTime();
  const nowMs = now.getTime();
  if (!Number.isFinite(expires) || expires <= nowMs) return new Date(nowMs);
  const target = expires - AUTO_DEBIT_LEAD_DAYS * DAY_MS;
  if (target >= nowMs + DAY_MS) return new Date(target);
  return new Date(nowMs + (expires - nowMs) / 2);
}

/**
 * Remboursement Stripe idempotent (clé stable : un même échec ne rembourse
 * qu'une fois, que l'appel vienne du webhook ou de verify-payment).
 * amountCents absent = remboursement total du paiement.
 */
export async function refundPayment(
  stripe: any,
  paymentIntentId: string,
  idempotencyKey: string,
  amountCents?: number
): Promise<{ refundId?: string; error?: string }> {
  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        ...(amountCents != null ? { amount: amountCents } : {}),
        reason: "requested_by_customer",
        metadata: { reason: "price_lock_refused_after_payment" },
      },
      { idempotencyKey }
    );
    return { refundId: refund.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

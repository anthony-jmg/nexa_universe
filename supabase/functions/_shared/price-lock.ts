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

export interface BalancePaymentInput {
  lockId: string;
  paymentIntentId: string;
  amount: number;
  userId: string | null;
  customerId: string | null;
  currency: string;
  metadata: Record<string, unknown> | null;
  autoDebit: boolean;
}

export type BalancePaymentResult =
  | { ok: true; lock: any }
  | { ok: false; error: string; refunded: boolean };

/**
 * Paiement du solde d'un Price Lock (manuel via Checkout ou débit automatique).
 *
 * 1. Le paiement est d'abord enregistré dans stripe_payments (unique par
 *    payment intent) : record_price_lock_payment le rattache au lock en même
 *    temps qu'il solde, ce qui rend tout second appel (webhook + verify, retry
 *    Stripe) idempotent.
 * 2. Si le lock ne peut pas être soldé par ce paiement (déjà soldé par un
 *    autre paiement, expiré, débit automatique en cours...), le paiement est
 *    remboursé : un client n'est jamais débité deux fois pour le même solde.
 */
export async function applyBalancePayment(
  supabase: any,
  stripe: any,
  input: BalancePaymentInput
): Promise<BalancePaymentResult> {
  await supabase.from("stripe_payments").upsert(
    {
      user_id: input.userId,
      stripe_payment_intent_id: input.paymentIntentId,
      stripe_customer_id: input.customerId,
      amount: input.amount,
      currency: input.currency || "eur",
      status: "succeeded",
      payment_type: "price_lock_balance",
      metadata: input.metadata,
    },
    { onConflict: "stripe_payment_intent_id", ignoreDuplicates: true }
  );

  const { data: lock, error: recordError } = await supabase.rpc("record_price_lock_payment", {
    p_lock_id: input.lockId,
    p_amount: input.amount,
    p_stripe_payment_intent_id: input.paymentIntentId,
    p_auto_debit: input.autoDebit,
  });

  if (recordError) {
    console.error(`Balance payment ${input.paymentIntentId} not applied to lock ${input.lockId}:`, recordError.message);
    const refund = await refundPayment(
      stripe,
      input.paymentIntentId,
      `price-lock-balance-refund-${input.paymentIntentId}`
    );
    if (refund.error) {
      console.error(`Refund failed for balance payment ${input.paymentIntentId}:`, refund.error);
    } else {
      await supabase
        .from("stripe_payments")
        .update({ status: "refunded" })
        .eq("stripe_payment_intent_id", input.paymentIntentId);
    }
    return { ok: false, error: recordError.message, refunded: !refund.error };
  }

  const { error: completeError } = await supabase.rpc("complete_price_lock_attendees", {
    p_lock_id: input.lockId,
  });
  if (completeError) {
    console.error(`Failed to confirm attendees for lock ${input.lockId}:`, completeError);
  }

  return { ok: true, lock };
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

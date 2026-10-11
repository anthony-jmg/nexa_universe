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

  // Création : le trigger applicque et protège toutes les règles métier
  const { data: lock, error: insertError } = await supabase
    .from("price_locks")
    .insert({
      user_id: userId,
      event_ticket_type_id: ticketTypeId,
    })
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

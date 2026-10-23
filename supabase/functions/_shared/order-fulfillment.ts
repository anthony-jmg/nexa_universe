/**
 * Livraison d'une commande panier payée — point d'entrée UNIQUE, appelé par
 * le webhook Stripe et par verify-payment.
 *
 * claim_paid_order (SQL, transaction verrouillée) vérifie propriétaire et
 * montant encaissé, passe la commande en processing/completed, décrémente le
 * stock et libère les réservations. Seul l'appel qui obtient le claim livre
 * la suite (Price Locks, billets, paiement) : un second appel concurrent ou
 * un retry Stripe ne refait rien.
 */

import { computeAutoDebitAt, createPriceLockAfterPayment, refundPayment } from "./price-lock.ts";

export type FulfillOrderResult =
  | { ok: true; status: string; alreadyProcessed?: boolean; refusedLocks?: number }
  | { ok: false; reason: string };

export async function fulfillPaidOrder(
  supabase: any,
  stripe: any,
  session: any,
  userId: string
): Promise<FulfillOrderResult> {
  const orderId = session.metadata?.order_id;
  if (!orderId) return { ok: false, reason: "missing_order_id" };

  const paymentIntentId: string | null = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;
  const amountPaid = (session.amount_total || 0) / 100;

  const { data: claim, error: claimError } = await supabase.rpc("claim_paid_order", {
    p_order_id: orderId,
    p_user_id: userId,
    p_amount_paid: amountPaid,
    p_payment_intent_id: paymentIntentId,
  });
  if (claimError) return { ok: false, reason: claimError.message };
  if (claim === "already_processed") return { ok: true, status: claim, alreadyProcessed: true };
  if (claim !== "processing" && claim !== "completed") {
    console.error(`Order ${orderId}: not fulfilled (${claim}, paid ${amountPaid}, user ${userId})`);
    return { ok: false, reason: claim };
  }

  const { data: orderItems } = await supabase
    .from("order_items")
    .select("id, event_ticket_type_id, purchase_type, deposit_amount, details")
    .eq("order_id", orderId);

  let orderPriceLockId: string | null = null;
  let refusedLocks = 0;
  const depositItems = (orderItems || []).filter(
    (item: any) => item.purchase_type === "price_lock_deposit" && item.event_ticket_type_id
  );

  for (const item of depositItems) {
    const depositAmount = Number(item.deposit_amount);
    // Pas de rapprochement par payment intent : une commande peut contenir
    // plusieurs locks (festivals différents) et le claim garantit l'unicité.
    const result = await createPriceLockAfterPayment(
      supabase,
      userId,
      item.event_ticket_type_id,
      null,
      depositAmount
    );

    if (result.error || !result.lockId) {
      // Lock refusé après paiement (fenêtre close, quota atteint...) :
      // l'acompte est remboursé et aucun billet n'est émis pour cette ligne.
      refusedLocks++;
      console.error(`Order ${orderId}: price lock refused for item ${item.id}: ${result.error}`);
      if (paymentIntentId && Number.isFinite(depositAmount) && depositAmount > 0) {
        const refund = await refundPayment(
          stripe,
          paymentIntentId,
          `price-lock-refund-${paymentIntentId}-${item.id}`,
          Math.round(depositAmount * 100)
        );
        if (refund.error) {
          console.error(`Order ${orderId}: refund failed for item ${item.id}: ${refund.error}`);
        }
      }
      await supabase
        .from("pending_event_attendees")
        .delete()
        .eq("reservation_id", orderId)
        .eq("event_ticket_type_id", item.event_ticket_type_id)
        .eq("purchase_type", "price_lock_deposit");
      continue;
    }

    if (!orderPriceLockId) orderPriceLockId = result.lockId;

    // Le mode validé dans order_items devient la configuration définitive du lock.
    const details = (item.details || {}) as Record<string, any>;
    const balanceMode = details.balance_payment_mode === "automatic" ? "automatic" : "manual";
    const lockPatch: Record<string, any> = {
      balance_payment_mode: balanceMode,
      order_item_id: item.id,
    };
    if (balanceMode === "automatic") {
      const { data: createdLock } = await supabase
        .from("price_locks")
        .select("expires_at")
        .eq("id", result.lockId)
        .maybeSingle();
      lockPatch.auto_balance_payment_at = createdLock?.expires_at
        ? computeAutoDebitAt(createdLock.expires_at).toISOString()
        : null;
      lockPatch.auto_balance_consent_at = new Date().toISOString();
      lockPatch.stripe_customer_id = session.customer as string;
      try {
        const paymentIntent = paymentIntentId
          ? await stripe.paymentIntents.retrieve(paymentIntentId)
          : null;
        if (paymentIntent?.payment_method) {
          lockPatch.stripe_payment_method_id = typeof paymentIntent.payment_method === "string"
            ? paymentIntent.payment_method
            : paymentIntent.payment_method.id;
        }
      } catch (error) {
        // Sans moyen de paiement, le débit automatique échouera proprement
        // (finalize 'failed') et le paiement manuel reste possible.
        console.error(`Order ${orderId}: payment method lookup failed for lock ${result.lockId}:`, error);
      }
    }
    await supabase
      .from("price_locks")
      .update(lockPatch)
      .eq("id", result.lockId)
      .or(`order_item_id.is.null,order_item_id.eq.${item.id}`);
  }

  const { error: convertError } = await supabase.rpc("convert_pending_to_actual_attendees", { p_order_id: orderId });
  if (convertError) {
    console.error(`Order ${orderId}: failed to convert pending attendees:`, convertError);
  }

  if (paymentIntentId) {
    const { data: existingPayment } = await supabase
      .from("stripe_payments")
      .select("id")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle();

    if (!existingPayment) {
      await supabase.from("stripe_payments").insert({
        user_id: userId,
        stripe_payment_intent_id: paymentIntentId,
        stripe_customer_id: session.customer as string,
        amount: amountPaid,
        currency: session.currency || "eur",
        status: "succeeded",
        payment_type: "order",
        order_id: orderId,
        price_lock_id: orderPriceLockId,
        metadata: session.metadata,
      });
    }
  }

  console.log(
    `Order ${orderId} fulfilled: status '${claim}', price locks ${depositItems.length - refusedLocks}/${depositItems.length}`
  );
  return { ok: true, status: claim, refusedLocks };
}

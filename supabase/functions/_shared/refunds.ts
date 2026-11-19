/**
 * Remboursement fait dans Stripe (tableau de bord, litige résolu...).
 *
 * Seul un remboursement TOTAL du paiement annule ce qu'il a produit dans Nexa :
 * billets non scannés annulés, places libérées, Price Lock du versement annulé
 * (apply_full_stripe_refund, idempotente). Un remboursement partiel ne change
 * rien et reste à traiter à la main. Les remboursements automatiques de Nexa
 * (paiement refusé après coup, pass complet) ne produisent aucun billet : la
 * fonction ne trouve alors rien à annuler.
 */
interface RpcClient {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export async function handleChargeRefunded(
  supabase: RpcClient,
  charge: { id: string; refunded?: boolean; payment_intent?: string | { id: string } | null }
): Promise<{ status: string; [key: string]: unknown }> {
  const paymentIntentId = typeof charge.payment_intent === "string"
    ? charge.payment_intent
    : charge.payment_intent?.id ?? null;
  if (!paymentIntentId) return { status: "no_payment_intent" };
  if (!charge.refunded) {
    console.log(`Charge ${charge.id} partially refunded: no automatic change`);
    return { status: "partial_refund_ignored" };
  }

  const { data, error } = await supabase.rpc("apply_full_stripe_refund", {
    p_payment_intent_id: paymentIntentId,
  });
  if (error) {
    // Relancé par Stripe (réponse en erreur) : la fonction est idempotente.
    throw new Error(`Refund ${paymentIntentId} not applied: ${error.message}`);
  }
  console.log(`Refund ${paymentIntentId} applied:`, JSON.stringify(data));
  return data as { status: string; [key: string]: unknown };
}

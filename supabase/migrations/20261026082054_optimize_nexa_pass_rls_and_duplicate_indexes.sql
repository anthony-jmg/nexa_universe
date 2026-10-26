/*
# Lot C — RLS Nexa Pass : auth.uid() évalué une fois par requête

1. Problème (advisor auth_rls_initplan)
- 26 politiques des tables Nexa Pass appellent auth.uid() directement : la
  fonction est réévaluée pour chaque ligne lue.

2. Correctif
- ALTER POLICY : expressions strictement identiques, auth.uid() remplacé par
  (select auth.uid()) (forme recommandée par Supabase, évaluée une seule fois).
  Aucune règle d'accès modifiée, aucun rôle ni commande changé.
- Index en double supprimés (copie identique conservée) :
  - cart_event_tickets_user_ticket_mode_unique : doublon de l'index de la
    contrainte cart_event_tickets_user_id_event_ticket_type_id_purchase_type_k
    (mêmes colonnes user_id, event_ticket_type_id, purchase_type ; unicité
    toujours garantie par la contrainte).
  - idx_videos_program : doublon de idx_videos_program_id (program_id),
    jamais utilisé (0 scan) alors que idx_videos_program_id l'est.
*/


ALTER POLICY "Users can manage own event cart" ON public.cart_event_tickets
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can manage own cart" ON public.cart_items
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Admins can manage attendees" ON public.event_attendees
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text))));

ALTER POLICY "Admins can view all attendees" ON public.event_attendees
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text))));

ALTER POLICY "Admins manage event pass files" ON public.event_attendees
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text))))
  WITH CHECK (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text))));

ALTER POLICY "Users can insert own attendance" ON public.event_attendees
  WITH CHECK (user_id = (select auth.uid()));

ALTER POLICY "Users can update own attendance" ON public.event_attendees
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

ALTER POLICY "Users can view own attendance" ON public.event_attendees
  USING (user_id = (select auth.uid()));

ALTER POLICY "Admins can delete price tiers" ON public.event_ticket_price_tiers
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text))));

ALTER POLICY "Admins can insert price tiers" ON public.event_ticket_price_tiers
  WITH CHECK (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text))));

ALTER POLICY "Admins can update price tiers" ON public.event_ticket_price_tiers
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text))))
  WITH CHECK (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text))));

ALTER POLICY "Admins can manage event ticket types" ON public.event_ticket_types
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text))));

ALTER POLICY "Admins can manage events" ON public.events
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text))));

ALTER POLICY "Users can update own notifications" ON public.notifications
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

ALTER POLICY "Users can view own notifications" ON public.notifications
  USING (user_id = (select auth.uid()));

ALTER POLICY "Admins can view audit log" ON public.order_audit_log
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text))));

ALTER POLICY "Admins can manage all order items" ON public.order_items
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text))));

ALTER POLICY "Users can view own order items" ON public.order_items
  USING (EXISTS ( SELECT 1 FROM orders WHERE ((orders.id = order_items.order_id) AND (orders.user_id = (select auth.uid())))));

ALTER POLICY "Admins can manage all orders" ON public.orders
  USING (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text))));

ALTER POLICY "Users can view own orders" ON public.orders
  USING (user_id = (select auth.uid()));

ALTER POLICY "System can manage pending attendees" ON public.pending_event_attendees
  USING ((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text)))));

ALTER POLICY "Users can view own price locks" ON public.price_locks
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can insert own Stripe customer data" ON public.stripe_customers
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can update own Stripe customer data" ON public.stripe_customers
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can view own Stripe customer data" ON public.stripe_customers
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can view own payments" ON public.stripe_payments
  USING ((select auth.uid()) = user_id);


DROP INDEX IF EXISTS public.cart_event_tickets_user_ticket_mode_unique;
DROP INDEX IF EXISTS public.idx_videos_program;

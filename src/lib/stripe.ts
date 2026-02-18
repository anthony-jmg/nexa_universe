import { supabase } from './supabase';

export interface CheckoutItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  metadata?: Record<string, string>;
}

export interface CreateCheckoutParams {
  payment_type: 'order' | 'video' | 'program' | 'professor_subscription' | 'event_ticket' | 'platform_subscription';
  items: CheckoutItem[];
  metadata?: Record<string, string>;
  price_id?: string;
}

export async function createStripeCheckout(params: CreateCheckoutParams): Promise<string> {
  const origin = window.location.origin;
  const success_url = `${origin}/my-purchases?payment=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancel_url = `${origin}/my-purchases?payment=cancelled`;

  const { data: { session: currentSession } } = await supabase.auth.getSession();
  let session = currentSession;

  if (!session) {
    throw new Error('You must be signed in to proceed with checkout');
  }

  const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
  const isExpiringSoon = expiresAt - Date.now() < 60 * 1000;
  if (isExpiringSoon) {
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    if (refreshed) {
      session = refreshed;
    }
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const apiUrl = `${supabaseUrl}/functions/v1/create-stripe-checkout`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      ...params,
      success_url,
      cancel_url,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Checkout error response:', data);

    // Handle specific Stripe errors
    if (data.error && data.error.includes('No such price')) {
      throw new Error('Configuration Stripe invalide. Veuillez vérifier que les Price IDs sont correctement configurés dans Stripe Dashboard.');
    }

    throw new Error(data.error || 'Failed to create checkout session');
  }

  if (!data?.url) {
    throw new Error('No checkout URL received');
  }

  return data.url;
}

export async function handleOrderCheckout(orderId: string, items: CheckoutItem[]): Promise<void> {
  const checkoutUrl = await createStripeCheckout({
    payment_type: 'order',
    items,
    metadata: {
      order_id: orderId,
      target_id: orderId,
    },
  });

  window.location.href = checkoutUrl;
}

export async function handleVideoCheckout(videoId: string, videoName: string, price: number): Promise<void> {
  const checkoutUrl = await createStripeCheckout({
    payment_type: 'video',
    items: [{
      id: videoId,
      name: videoName,
      price,
      quantity: 1,
    }],
    metadata: {
      video_id: videoId,
      target_id: videoId,
    },
  });

  window.location.href = checkoutUrl;
}

export async function handleProfessorSubscriptionCheckout(
  professorId: string,
  professorName: string,
  price: number
): Promise<void> {
  const checkoutUrl = await createStripeCheckout({
    payment_type: 'professor_subscription',
    items: [{
      id: professorId,
      name: `Monthly subscription to ${professorName}`,
      price,
      quantity: 1,
      metadata: {
        professor_id: professorId,
      },
    }],
    metadata: {
      professor_id: professorId,
      target_id: professorId,
      payment_type: 'professor_subscription',
    },
  });

  window.location.href = checkoutUrl;
}

export async function handlePlatformSubscriptionCheckout(
  price: number,
  planType: 'monthly' | 'yearly'
): Promise<void> {
  const planName = planType === 'monthly' ? 'Monthly Platform Subscription' : 'Yearly Platform Subscription';
  const priceId = planType === 'monthly'
    ? import.meta.env.VITE_STRIPE_PLATFORM_MONTHLY_PRICE_ID
    : import.meta.env.VITE_STRIPE_PLATFORM_YEARLY_PRICE_ID;

  if (!priceId) {
    throw new Error(`Missing Stripe Price ID for ${planType} subscription. Please check environment variables.`);
  }

  console.log('Platform Subscription Checkout:', {
    planType,
    priceId,
    price,
    planName,
    env_monthly: import.meta.env.VITE_STRIPE_PLATFORM_MONTHLY_PRICE_ID,
    env_yearly: import.meta.env.VITE_STRIPE_PLATFORM_YEARLY_PRICE_ID,
  });

  const checkoutUrl = await createStripeCheckout({
    payment_type: 'platform_subscription',
    items: [{
      id: 'platform-subscription',
      name: planName,
      price,
      quantity: 1,
    }],
    metadata: {
      subscription_type: 'platform',
      plan_type: planType,
      target_id: 'platform',
      payment_type: 'platform_subscription',
    },
    price_id: priceId,
  });

  window.location.href = checkoutUrl;
}

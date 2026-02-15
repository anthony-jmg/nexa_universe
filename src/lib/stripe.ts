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
  const success_url = `${origin}/my-purchases?payment=success`;
  const cancel_url = `${origin}/my-purchases?payment=cancelled`;

  const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
    body: {
      ...params,
      success_url,
      cancel_url,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to create checkout session');
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

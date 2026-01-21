import { useState } from 'react';
import { createStripeCheckout, CreateCheckoutParams } from '../lib/stripe';

export function useStripeCheckout() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = async (params: CreateCheckoutParams) => {
    setIsLoading(true);
    setError(null);

    try {
      const checkoutUrl = await createStripeCheckout(params);
      window.location.href = checkoutUrl;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start checkout';
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  return {
    startCheckout,
    isLoading,
    error,
  };
}

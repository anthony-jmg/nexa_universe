import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function useSubscription() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelSubscription = async (
    subscriptionType: 'platform' | 'professor',
    professorId?: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to cancel your subscription');
      }

      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: {
          action: 'cancel',
          subscription_type: subscriptionType,
          professor_id: professorId,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to cancel subscription');
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel subscription';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const reactivateSubscription = async (
    subscriptionType: 'platform' | 'professor',
    professorId?: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to reactivate your subscription');
      }

      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: {
          action: 'reactivate',
          subscription_type: subscriptionType,
          professor_id: professorId,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to reactivate subscription');
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reactivate subscription';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    cancelSubscription,
    reactivateSubscription,
    loading,
    error,
  };
}

import { useState, useCallback } from 'react';
import { AsyncState, ApiError } from '../types/errors';
import { handleSupabaseError } from '../lib/errorHandler';

export function useAsync<T>() {
  const [state, setState] = useState<AsyncState<T>>({ status: 'idle' });

  const execute = useCallback(
    async (asyncFunction: () => Promise<T>): Promise<T | undefined> => {
      setState({ status: 'loading' });
      try {
        const data = await asyncFunction();
        setState({ status: 'success', data });
        return data;
      } catch (error) {
        const appError = handleSupabaseError(error as Error);
        const apiError: ApiError = {
          message: appError.message,
          code: appError.code,
          statusCode: appError.statusCode,
          details: appError.details,
        };
        setState({ status: 'error', error: apiError });
        return undefined;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  return {
    state,
    execute,
    reset,
    isLoading: state.status === 'loading',
    isError: state.status === 'error',
    isSuccess: state.status === 'success',
    data: state.status === 'success' ? state.data : undefined,
    error: state.status === 'error' ? state.error : undefined,
  };
}

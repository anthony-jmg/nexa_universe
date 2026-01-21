import { useState, useEffect, useCallback } from 'react';
import { createGlobalCache } from './useCache';

const dataCache = createGlobalCache<any>(5 * 60 * 1000);

interface UseCachedDataOptions<T> {
  cacheKey: string;
  fetchFn: () => Promise<T>;
  dependencies?: any[];
  enabled?: boolean;
}

export function useCachedData<T>({
  cacheKey,
  fetchFn,
  dependencies = [],
  enabled = true
}: UseCachedDataOptions<T>) {
  const [data, setData] = useState<T | null>(() => dataCache.get(cacheKey));
  const [loading, setLoading] = useState<boolean>(!dataCache.has(cacheKey));
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async (force = false) => {
    if (!enabled) {
      return;
    }

    if (!force && dataCache.has(cacheKey)) {
      const cachedData = dataCache.get(cacheKey);
      if (cachedData !== null) {
        setData(cachedData);
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);
      const result = await fetchFn();
      dataCache.set(cacheKey, result);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An error occurred'));
    } finally {
      setLoading(false);
    }
  }, [cacheKey, fetchFn, enabled]);

  const refetch = useCallback(() => {
    dataCache.remove(cacheKey);
    return fetchData(true);
  }, [cacheKey, fetchData]);

  const invalidate = useCallback(() => {
    dataCache.remove(cacheKey);
    setData(null);
  }, [cacheKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData, ...dependencies]);

  return {
    data,
    loading,
    error,
    refetch,
    invalidate,
    isStale: !dataCache.has(cacheKey)
  };
}

export { dataCache };

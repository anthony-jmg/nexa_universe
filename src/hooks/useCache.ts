import { useRef, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface CacheOptions {
  ttl?: number;
}

export function useCache<T>(options: CacheOptions = {}) {
  const { ttl = 5 * 60 * 1000 } = options;
  const cache = useRef<Map<string, CacheEntry<T>>>(new Map());

  const get = useCallback((key: string): T | null => {
    const entry = cache.current.get(key);

    if (!entry) {
      return null;
    }

    const isExpired = Date.now() - entry.timestamp > ttl;

    if (isExpired) {
      cache.current.delete(key);
      return null;
    }

    return entry.data;
  }, [ttl]);

  const set = useCallback((key: string, data: T) => {
    cache.current.set(key, {
      data,
      timestamp: Date.now()
    });
  }, []);

  const remove = useCallback((key: string) => {
    cache.current.delete(key);
  }, []);

  const clear = useCallback(() => {
    cache.current.clear();
  }, []);

  const has = useCallback((key: string): boolean => {
    const entry = cache.current.get(key);

    if (!entry) {
      return false;
    }

    const isExpired = Date.now() - entry.timestamp > ttl;

    if (isExpired) {
      cache.current.delete(key);
      return false;
    }

    return true;
  }, [ttl]);

  return { get, set, remove, clear, has };
}

export function createGlobalCache<T>(ttl: number = 5 * 60 * 1000) {
  const cache = new Map<string, CacheEntry<T>>();

  return {
    get(key: string): T | null {
      const entry = cache.get(key);

      if (!entry) {
        return null;
      }

      const isExpired = Date.now() - entry.timestamp > ttl;

      if (isExpired) {
        cache.delete(key);
        return null;
      }

      return entry.data;
    },

    set(key: string, data: T) {
      cache.set(key, {
        data,
        timestamp: Date.now()
      });
    },

    remove(key: string) {
      cache.delete(key);
    },

    clear() {
      cache.clear();
    },

    has(key: string): boolean {
      const entry = cache.get(key);

      if (!entry) {
        return false;
      }

      const isExpired = Date.now() - entry.timestamp > ttl;

      if (isExpired) {
        cache.delete(key);
        return false;
      }

      return true;
    }
  };
}

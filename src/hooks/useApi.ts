'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface DbResult<T = unknown> {
  data: T | null;
  error: unknown;
}

export function useApiFetch<T = unknown>(
  fetcher: () => Promise<DbResult<T>>,
  deps: unknown[] = []
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (result.error) {
        setError(typeof result.error === 'string' ? result.error : (result.error as Record<string, unknown>)?.message as string || 'حدث خطأ');
      } else {
        setData(result.data);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { execute(); }, [execute]);

  return { data, loading, error, refetch: execute };
}

export function useApiMutation<T = unknown>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = async (
    url: string,
    method: 'POST' | 'PATCH' | 'DELETE' = 'POST',
    body?: Record<string, unknown>
  ): Promise<{ data: T | null; error: unknown }> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await res.json();
      if (result.error) setError(result.error?.message || result.error);
      return result;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'حدث خطأ';
      setError(msg);
      return { data: null, error: msg };
    } finally {
      setLoading(false);
    }
  };

  return { execute, loading, error };
}

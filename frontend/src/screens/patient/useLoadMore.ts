'use client';
/*
 * Chioni — « Voir plus » pagination hook for the patient space.
 *
 * Loads page 1 on mount (or when `enabled` flips true — lazy tabs), appends
 * the next page on demand. Numbered pagination is deliberately avoided for
 * this audience: one big button, results simply grow.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Paginated } from '@/lib/types';

export interface LoadMore<T> {
  items: T[];
  /** Total count reported by the API (null until first load succeeds). */
  count: number | null;
  /** First-page load in flight. */
  loading: boolean;
  /** Next-page load in flight. */
  loadingMore: boolean;
  error: unknown;
  hasMore: boolean;
  loadMore: () => void;
  /** Reset to page 1 and refetch (after a mutating action). */
  reload: () => void;
}

export function useLoadMore<T>(
  fetchPage: (page: number) => Promise<Paginated<T>>,
  enabled = true,
): LoadMore<T> {
  const [items, setItems] = useState<T[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(0);
  const startedRef = useRef(false);
  // Invalidates in-flight responses on reload/unmount.
  const runRef = useRef(0);

  const loadFirst = useCallback(() => {
    const run = ++runRef.current;
    pageRef.current = 0;
    setLoading(true);
    setError(null);
    fetchPage(1)
      .then((data) => {
        if (run !== runRef.current) return;
        pageRef.current = 1;
        setItems(data.results);
        setCount(data.count);
        setHasMore(data.next !== null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (run !== runRef.current) return;
        setError(err);
        setLoading(false);
      });
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    const run = runRef.current;
    const next = pageRef.current + 1;
    setLoadingMore(true);
    fetchPage(next)
      .then((data) => {
        if (run !== runRef.current) return;
        pageRef.current = next;
        setItems((cur) => [...cur, ...data.results]);
        setCount(data.count);
        setHasMore(data.next !== null);
        setLoadingMore(false);
      })
      .catch((err: unknown) => {
        if (run !== runRef.current) return;
        setError(err);
        setLoadingMore(false);
      });
  }, [fetchPage, loading, loadingMore, hasMore]);

  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;
    loadFirst();
  }, [enabled, loadFirst]);

  useEffect(() => {
    return () => {
      runRef.current += 1;
    };
  }, []);

  return { items, count, loading, loadingMore, error, hasMore, loadMore, reload: loadFirst };
}

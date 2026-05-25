import { useCallback, useEffect, useRef, useState } from 'react'

import {
  fetchWithResourceCache,
  getResourceCached,
  invalidateResourceCache,
  type FetchWithResourceCacheOptions,
} from '@/utils/resource-cache'

export interface UseCachedResourceOptions<T> {
  key: string | null
  ttlMs: number
  enabled?: boolean
  fetcher: () => Promise<T | null>
}

export interface UseCachedResourceResult<T> {
  data: T | null
  isLoading: boolean
  isRefreshing: boolean
  isStale: boolean
  error: string | null
  refresh: (options?: FetchWithResourceCacheOptions) => Promise<void>
}

export function useCachedResource<T>({
  key,
  ttlMs,
  enabled = true,
  fetcher,
}: UseCachedResourceOptions<T>): UseCachedResourceResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isStale, setIsStale] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mountedRef = useRef(true)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const load = useCallback(async (options?: FetchWithResourceCacheOptions) => {
    if (!key || !enabled) {
      if (mountedRef.current) {
        setData(null)
        setIsLoading(false)
        setIsRefreshing(false)
        setIsStale(false)
      }
      return
    }

    const background = options?.force === true && data !== null

    if (!background && !options?.force) {
      const cached = await getResourceCached<T>(key)
      if (cached && mountedRef.current) {
        setData(cached.data)
        setIsLoading(false)
        setError(null)
        if (!cached.isStale) {
          setIsStale(false)
          return
        }
        setIsStale(true)
      }
    }

    if (background) {
      if (mountedRef.current) setIsRefreshing(true)
    } else if (!options?.force) {
      const cached = await getResourceCached<T>(key)
      if (!cached && mountedRef.current) setIsLoading(true)
    } else if (mountedRef.current) {
      setIsLoading(true)
    }

    try {
      const fresh = await fetchWithResourceCache<T>(
        key,
        ttlMs,
        () => fetcherRef.current(),
        { ...options, allowStale: options?.allowStale ?? true },
      )
      if (mountedRef.current) {
        if (fresh !== null) setData(fresh)
        setIsStale(false)
        setError(null)
      }
    } catch {
      if (mountedRef.current && data === null) {
        setError('Could not load data. Pull to refresh.')
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    }
  }, [key, ttlMs, enabled, data])

  useEffect(() => {
    setIsLoading(true)
    setData(null)
    setError(null)
    setIsStale(false)
    void load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  const refresh = useCallback(async (options?: FetchWithResourceCacheOptions) => {
    if (!key) return
    if (options?.force !== false) {
      await invalidateResourceCache(key)
    }
    await load({ force: true, ...options })
  }, [key, load])

  return { data, isLoading, isRefreshing, isStale, error, refresh }
}

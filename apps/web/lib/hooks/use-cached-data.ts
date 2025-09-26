'use client'

import { useState, useEffect, useCallback } from 'react'

interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  key: string
}

/**
 * Custom hook for cached data that reduces unnecessary API calls
 * Combines both memory cache and session storage
 */
export function useCachedData<T>(
  fetchFn: () => Promise<T>,
  options: CacheOptions
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const { ttl = 5 * 60 * 1000, key } = options // Default 5 minutes

  // Check if cached data is still valid
  const isCacheValid = useCallback(() => {
    try {
      const cached = sessionStorage.getItem(`cache_${key}`)
      if (!cached) return false

      const { data: cachedData, timestamp } = JSON.parse(cached)
      const now = Date.now()

      return (now - timestamp) < ttl
    } catch {
      return false
    }
  }, [key, ttl])

  // Get data from cache
  const getCachedData = useCallback((): T | null => {
    try {
      const cached = sessionStorage.getItem(`cache_${key}`)
      if (!cached) return null

      const { data: cachedData } = JSON.parse(cached)
      return cachedData
    } catch {
      return null
    }
  }, [key])

  // Set data to cache
  const setCachedData = useCallback((newData: T) => {
    try {
      const cacheEntry = {
        data: newData,
        timestamp: Date.now()
      }
      sessionStorage.setItem(`cache_${key}`, JSON.stringify(cacheEntry))
    } catch (error) {
      console.warn(`Failed to cache data for key "${key}":`, error)
    }
  }, [key])

  // Fetch data with caching
  const fetchData = useCallback(async (forceRefresh = false) => {
    // Check cache first unless forcing refresh
    if (!forceRefresh && isCacheValid()) {
      const cachedData = getCachedData()
      if (cachedData) {
        setData(cachedData)
        setLoading(false)
        return cachedData
      }
    }

    setLoading(true)
    setError(null)

    try {
      const freshData = await fetchFn()
      setData(freshData)
      setCachedData(freshData)
      return freshData
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      throw err
    } finally {
      setLoading(false)
    }
  }, [fetchFn, isCacheValid, getCachedData, setCachedData])

  // Load data on mount
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Invalidate cache
  const invalidateCache = useCallback(() => {
    try {
      sessionStorage.removeItem(`cache_${key}`)
    } catch (error) {
      console.warn(`Failed to invalidate cache for key "${key}":`, error)
    }
  }, [key])

  // Refresh data
  const refresh = useCallback(() => {
    return fetchData(true)
  }, [fetchData])

  return {
    data,
    loading,
    error,
    refresh,
    invalidateCache
  }
}
'use client'

import { useState, useEffect } from 'react'

/**
 * Serialize data to JSON, handling Sets and other complex types
 */
function serialize(data: any): string {
  return JSON.stringify(data, (key, value) => {
    if (value instanceof Set) {
      return { __type: 'Set', value: Array.from(value) }
    }
    return value
  })
}

/**
 * Deserialize data from JSON, handling Sets and other complex types
 */
function deserialize(jsonString: string): any {
  return JSON.parse(jsonString, (key, value) => {
    if (value && typeof value === 'object' && value.__type === 'Set') {
      return new Set(value.value)
    }
    return value
  })
}

/**
 * Custom hook for persistent state that survives page refreshes and navigation
 * Stores state in sessionStorage for tab-level persistence
 */
export function usePersistentState<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(initialValue)

  // Load from sessionStorage on mount
  useEffect(() => {
    try {
      const item = sessionStorage.getItem(key)
      if (item) {
        setState(deserialize(item))
      }
    } catch (error) {
      console.warn(`Failed to load persistent state for key "${key}":`, error)
    }
  }, [key])

  // Update sessionStorage when state changes
  const setPersistentState = (value: T | ((prev: T) => T)) => {
    setState((prev) => {
      const newValue = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value
      try {
        sessionStorage.setItem(key, serialize(newValue))
      } catch (error) {
        console.warn(`Failed to save persistent state for key "${key}":`, error)
      }
      return newValue
    })
  }

  return [state, setPersistentState]
}
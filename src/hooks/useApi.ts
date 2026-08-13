'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface ApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * تحويل أي كائن خطأ إلى نص لتجنب خطأ React #31
 */
export function toErrorMessage(err: any, fallback = 'حدث خطأ'): string {
  if (!err) return fallback
  if (typeof err === 'string') return err
  if (typeof err.message === 'string') return err.message
  if (typeof err.error === 'string') return err.error
  if (typeof err.error?.message === 'string') return err.error.message
  if (typeof err.code === 'string') return err.message ? `${err.code}: ${err.message}` : err.code
  try {
    const s = JSON.stringify(err)
    return s === '{}' ? fallback : s
  } catch {
    return fallback
  }
}

/**
 * useApi<T>(path) — GET hook
 */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: !!path,
    error: null,
  })
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async () => {
    if (!path) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const res = await fetch(path, { signal: controller.signal })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        const msg = toErrorMessage(json?.error || json, `HTTP ${res.status}`)
        throw new Error(msg)
      }

      if (!controller.signal.aborted) {
        setState({ data: json.data !== undefined ? json.data : json, loading: false, error: null })
      }
      return json.data !== undefined ? json.data : json
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return null
      const message = toErrorMessage(err, 'حدث خطأ')
      if (!controller.signal.aborted) {
        setState((prev) => ({ ...prev, loading: false, error: message }))
      }
      return null
    }
  }, [path])

  useEffect(() => {
    if (path) {
      fetchData()
    }
    return () => {
      abortRef.current?.abort()
    }
  }, [fetchData, path])

  return { ...state, refetch: fetchData }
}

/**
 * useApiMutation() — POST/PUT/PATCH/DELETE hook
 */
export function useApiMutation() {
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const mutate = useCallback(
    async <T = any>(method: string, path: string, body?: unknown): Promise<{ error: string | null; data: T | null }> => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)

      try {
        const res = await fetch(path, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        })

        const json = await res.json().catch(() => ({}))

        if (!res.ok) {
          const msg = toErrorMessage(json?.error || json, `HTTP ${res.status}`)
          return { error: msg, data: null }
        }

        return { error: null, data: json.data !== undefined ? json.data : json }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return { error: null, data: null }
        }
        const message = toErrorMessage(err, 'حدث خطأ')
        return { error: message, data: null }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    },
    []
  )

  return { mutate, loading }
}

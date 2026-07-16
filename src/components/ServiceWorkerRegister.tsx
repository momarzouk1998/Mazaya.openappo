'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker for PWA install + offline support.
 * Kept separate so RootLayout can stay a server component.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          // When a new SW takes over (post-deploy), reload once so the page
          // fetches fresh HTML + chunks instead of holding stale references
          // that cause ChunkLoadError.
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' })
          }
          reg.addEventListener('updatefound', () => {
            const installing = reg.installing
            if (!installing) return
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                // A new version is ready — reload to activate it.
                window.location.reload()
              }
            })
          })
        })
        .catch(() => {
          // Silently ignore — SW is a progressive enhancement.
        })
    }

    // Also reload when the controller changes (covers skipWaiting path).
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Guard against a reload loop in browsers that fire it twice.
      if (window.location.hash.includes('sw-reloaded')) return
      window.location.hash = 'sw-reloaded'
      window.location.reload()
    })

    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad, { once: true })
    return () => window.removeEventListener('load', onLoad)
  }, [])

  return null
}

'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const CrmChatWidget = dynamic(() => import('@/components/CrmChatWidget'), { ssr: false })
const CookieConsent = dynamic(() => import('@/components/CookieConsent'), { ssr: false })
const GoogleAnalytics = dynamic(() => import('@/components/GoogleAnalytics'), { ssr: false })

function scheduleIdle(callback: () => void) {
  if (typeof globalThis === 'undefined' || typeof globalThis.setTimeout !== 'function') {
    return () => {}
  }

  const maybeWithIdle = globalThis as typeof globalThis & {
    requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number
    cancelIdleCallback?: (id: number) => void
  }

  if (typeof maybeWithIdle.requestIdleCallback === 'function') {
    const idleId = maybeWithIdle.requestIdleCallback(() => callback(), { timeout: 3000 })
    return () => {
      if (typeof maybeWithIdle.cancelIdleCallback === 'function') {
        maybeWithIdle.cancelIdleCallback(idleId)
      }
    }
  }

  const timerId = globalThis.setTimeout(callback, 1800)
  return () => globalThis.clearTimeout(timerId)
}

export default function DeferredClientFeatures() {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false)

  useEffect(() => {
    if (analyticsEnabled) return

    const enable = () => setAnalyticsEnabled(true)
    const cancelIdle = scheduleIdle(enable)

    const userEvents: Array<keyof WindowEventMap> = ['scroll', 'pointerdown', 'keydown', 'touchstart']
    userEvents.forEach((eventName) => window.addEventListener(eventName, enable, { once: true, passive: true }))

    return () => {
      cancelIdle()
      userEvents.forEach((eventName) => window.removeEventListener(eventName, enable))
    }
  }, [analyticsEnabled])

  return (
    <>
      <CrmChatWidget />
      {analyticsEnabled && (
        <>
          <GoogleAnalytics />
          <CookieConsent />
        </>
      )}
    </>
  )
}

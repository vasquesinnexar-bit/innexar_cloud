'use client'

import Script from 'next/script'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-23YD60MCM4'
const COOKIE_CONSENT_KEY = 'innexar_cookie_consent'
const TRACKING_ENABLED = process.env.NEXT_PUBLIC_ENABLE_TRACKING === 'true'

type CookiePreferences = {
  essential: boolean
  analytics: boolean
  marketing: boolean
}

export default function GoogleAnalytics() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false)

  useEffect(() => {
    if (!TRACKING_ENABLED) {
      return
    }

    const readConsent = () => {
      try {
        const rawConsent = window.localStorage.getItem(COOKIE_CONSENT_KEY)
        if (!rawConsent) {
          setAnalyticsEnabled(false)
          return
        }

        const parsed = JSON.parse(rawConsent) as CookiePreferences
        setAnalyticsEnabled(Boolean(parsed.analytics))
      } catch {
        setAnalyticsEnabled(false)
      }
    }

    const onConsentUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<CookiePreferences>
      setAnalyticsEnabled(Boolean(customEvent.detail?.analytics))
    }

    readConsent()
    window.addEventListener('cookieConsentUpdated', onConsentUpdate)
    return () => window.removeEventListener('cookieConsentUpdated', onConsentUpdate)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && analyticsEnabled && window.gtag) {
      const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '')
      window.gtag('event', 'page_view', {
        page_path: url,
      })
    }
  }, [pathname, searchParams, analyticsEnabled])

  if (!analyticsEnabled) {
    return null
  }

  if (!TRACKING_ENABLED) {
    return null
  }

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('set','allow_google_signals',false);gtag('set','allow_ad_personalization_signals',false);gtag('set','ads_data_redaction',true);gtag('config','${GA_MEASUREMENT_ID}',{send_page_view:false,anonymize_ip:true});gtag('event','page_view',{page_path:window.location.pathname});`,
        }}
      />
    </>
  )
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    dataLayer: any[]
    gtag: (...args: any[]) => void
  }
}


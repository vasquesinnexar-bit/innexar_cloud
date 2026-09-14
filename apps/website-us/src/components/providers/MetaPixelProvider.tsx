'use client'

import { useEffect, useState } from 'react'
import { initMetaPixel } from '@/lib/meta-pixel'

const COOKIE_CONSENT_KEY = 'innexar_cookie_consent'
const TRACKING_ENABLED = process.env.NEXT_PUBLIC_ENABLE_TRACKING === 'true'

type CookiePreferences = {
    essential: boolean
    analytics: boolean
    marketing: boolean
}

interface MetaPixelProviderProps {
    pixelId?: string
    children: React.ReactNode
}

export function MetaPixelProvider({ pixelId, children }: MetaPixelProviderProps) {
    const [marketingEnabled, setMarketingEnabled] = useState(false)

    useEffect(() => {
        if (!TRACKING_ENABLED) {
            setMarketingEnabled(false)
            return
        }

        const readConsent = () => {
            try {
                const rawConsent = window.localStorage.getItem(COOKIE_CONSENT_KEY)
                if (!rawConsent) {
                    setMarketingEnabled(false)
                    return
                }

                const parsed = JSON.parse(rawConsent) as CookiePreferences
                setMarketingEnabled(Boolean(parsed.marketing))
            } catch {
                setMarketingEnabled(false)
            }
        }

        const onConsentUpdate = (event: Event) => {
            const customEvent = event as CustomEvent<CookiePreferences>
            setMarketingEnabled(Boolean(customEvent.detail?.marketing))
        }

        readConsent()
        window.addEventListener('cookieConsentUpdated', onConsentUpdate)
        return () => window.removeEventListener('cookieConsentUpdated', onConsentUpdate)
    }, [])

    useEffect(() => {
        if (TRACKING_ENABLED && marketingEnabled) {
            initMetaPixel(pixelId)
        }
    }, [marketingEnabled, pixelId])

    return <>{children}</>
}

export default MetaPixelProvider

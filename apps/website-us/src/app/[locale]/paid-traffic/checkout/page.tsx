'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from '@/i18n/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import Header from '@/components/Header'

const API_PAID_TRAFFIC_PRODUCTS = process.env.NEXT_PUBLIC_WORKSPACE_API_URL
  ? `${process.env.NEXT_PUBLIC_WORKSPACE_API_URL}/api/public/products/paid-traffic`
  : ''

type PaidTrafficPlan = {
  slug: string
  name: string
  price: number
  currency: string
  includes: string[]
}

const FALLBACK_PLANS: PaidTrafficPlan[] = [
  {
    slug: 'start',
    name: 'Paid Traffic Start',
    price: 97,
    currency: 'USD',
    includes: [
      'Meta Ads management (Facebook & Instagram)',
      '1 campaign setup (lead generation)',
      'Up to 2 ad sets',
      'Audience targeting strategy',
      'Campaign setup and monitoring',
      'Basic monthly report',
    ],
  },
  {
    slug: 'growth',
    name: 'Paid Traffic Growth',
    price: 197,
    currency: 'USD',
    includes: [
      'Full Meta Ads management',
      'Up to 3 campaigns',
      'A/B testing',
      'Weekly optimization',
      'Detailed report with insights',
    ],
  },
  {
    slug: 'premium',
    name: 'Paid Traffic Premium',
    price: 397,
    currency: 'USD',
    includes: [
      'Meta Ads + Google Ads management',
      'Full funnel strategy',
      'Advanced remarketing',
      'Performance scaling',
      'Priority support',
    ],
  },
]

function PaidTrafficCheckoutContent() {
  const tCheckout = useTranslations('launch.checkout')
  const tPage = useTranslations('launch.checkoutPage')
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const planSlug = (searchParams.get('plan') || '').trim().toLowerCase()

  const [plan, setPlan] = useState<PaidTrafficPlan | null>(null)
  const [plansLoaded, setPlansLoaded] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Inline login state
  const [accountExists, setAccountExists] = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [password, setPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const lastCheckedEmailRef = useRef('')

  const validSlugs = ['start', 'growth', 'premium']
  const slugValid = validSlugs.includes(planSlug)

  // Auto-authenticate from portal token in URL (?auth_token=...)
  useEffect(() => {
    const portalToken = searchParams.get('auth_token')
    if (!portalToken) return
    const WORKSPACE_API_URL = process.env.NEXT_PUBLIC_WORKSPACE_API_URL || 'https://api3.innexar.app'
    fetch(`${WORKSPACE_API_URL.replace(/\/$/, '')}/api/portal/me/profile`, {
      headers: { Authorization: `Bearer ${portalToken}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.email) {
          setEmail(data.email)
          setName(data.name || data.customer_name || '')
          setPhone(data.phone || '')
          setAuthToken(portalToken)
          setLoggedIn(true)
          setAccountExists(true)
        }
      })
      .catch(() => {})
  }, [searchParams])

  useEffect(() => {
    if (!slugValid && planSlug !== '') {
      router.replace('/paid-traffic')
    }
  }, [slugValid, planSlug, router])

  useEffect(() => {
    if (!slugValid) return
    if (API_PAID_TRAFFIC_PRODUCTS) {
      fetch(API_PAID_TRAFFIC_PRODUCTS)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: PaidTrafficPlan[] | null) => {
          if (Array.isArray(data) && data.length > 0) {
            setPlan(
              data.find((p) => (p.slug || '').toLowerCase() === planSlug) ??
                FALLBACK_PLANS.find((p) => p.slug === planSlug) ??
                null
            )
          } else {
            setPlan(FALLBACK_PLANS.find((p) => p.slug === planSlug) ?? null)
          }
        })
        .catch(() => setPlan(FALLBACK_PLANS.find((p) => p.slug === planSlug) ?? null))
        .finally(() => setPlansLoaded(true))
      return
    }
    setPlan(FALLBACK_PLANS.find((p) => p.slug === planSlug) ?? null)
    setPlansLoaded(true)
  }, [planSlug, slugValid])

  const handleEmailBlur = useCallback(async () => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || trimmed.length < 5 || !trimmed.includes('@') || loggedIn) return
    if (trimmed === lastCheckedEmailRef.current) return
    lastCheckedEmailRef.current = trimmed
    setCheckingEmail(true)
    setLoginError(null)
    try {
      const res = await fetch('/api/paid-traffic/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.exists) {
        setAccountExists(true)
        if (data.customer_name && !name) setName(data.customer_name)
      } else {
        setAccountExists(false)
        setPassword('')
      }
    } catch {
      // Silently ignore - user can still checkout as new
    } finally {
      setCheckingEmail(false)
    }
  }, [email, loggedIn, name])

  const handleInlineLogin = useCallback(async () => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !password) return
    setLoggingIn(true)
    setLoginError(null)
    try {
      const res = await fetch('/api/paid-traffic/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLoginError(data.error || 'Invalid email or password')
        return
      }
      setAuthToken(data.access_token)
      setLoggedIn(true)
      if (data.customer_name && !name) setName(data.customer_name)
      if (data.customer_phone && !phone) setPhone(data.customer_phone)
      setLoginError(null)
    } catch {
      setLoginError('Login failed. Please try again.')
    } finally {
      setLoggingIn(false)
    }
  }, [email, password, name, phone])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      const trimmedEmail = email.trim()
      if (!trimmedEmail) {
        setError(tCheckout('error'))
        return
      }
      if (!agreeTerms) {
        setError(tPage('termsRequired'))
        return
      }
      if (!agreePrivacy) {
        setError(tPage('privacyRequired'))
        return
      }

      setSubmitting(true)
      try {
        const res = await fetch('/api/paid-traffic/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan_slug: planSlug,
            customer_email: trimmedEmail,
            customer_name: name.trim() || undefined,
            customer_phone: phone.replace(/\D/g, '').trim() || undefined,
            company_name: companyName.trim() || undefined,
            coupon_code: couponCode.trim() || undefined,
            locale,
          }),
        })

        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError((data.error as string) ?? tCheckout('error'))
          setSubmitting(false)
          return
        }

        const paymentUrl = data.payment_url as string | undefined
        if (paymentUrl) {
          window.location.href = paymentUrl
          return
        }
        setError(tCheckout('error'))
      } catch {
        setError(tCheckout('error'))
      } finally {
        setSubmitting(false)
      }
    },
    [email, name, phone, companyName, couponCode, agreeTerms, agreePrivacy, planSlug, locale, tCheckout, tPage]
  )

  if (!slugValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <Header />
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
      <Header />
      <div className="relative z-10 pt-[120px] pb-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <button
              type="button"
              onClick={() => router.push('/paid-traffic')}
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to paid traffic plans
            </button>
          </motion.div>

          <div className="grid md:grid-cols-5 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="md:col-span-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 md:p-8"
            >
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-6">Complete your subscription</h1>

              {!plansLoaded || !plan ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="checkout-email" className="mb-1 block text-sm font-medium text-slate-300">
                      {tCheckout('email')} <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="checkout-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value)
                          if (loggedIn) {
                            setLoggedIn(false)
                            setAccountExists(false)
                            setAuthToken(null)
                            setPassword('')
                          }
                        }}
                        onBlur={handleEmailBlur}
                        placeholder={tCheckout('emailPlaceholder')}
                        className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        disabled={submitting || loggedIn}
                        autoComplete="email"
                      />
                      {checkingEmail && (
                        <Loader2 className="absolute right-3 top-3.5 w-5 h-5 text-blue-400 animate-spin" />
                      )}
                      {loggedIn && (
                        <span className="absolute right-3 top-3.5 text-emerald-400 text-sm font-medium flex items-center gap-1">
                          <Check className="w-4 h-4" /> {tPage('loggedIn')}
                        </span>
                      )}
                    </div>
                  </div>

                  {accountExists && !loggedIn && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="rounded-xl border border-blue-400/30 bg-blue-500/10 p-4 space-y-3"
                    >
                      <p className="text-sm text-blue-300">
                        {tPage('welcomeBack')}
                      </p>
                      <div>
                        <label htmlFor="checkout-password" className="mb-1 block text-sm font-medium text-slate-300">
                          {tPage('password')}
                        </label>
                        <input
                          id="checkout-password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleInlineLogin() } }}
                          placeholder={tPage('passwordPlaceholder')}
                          className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          disabled={loggingIn}
                          autoComplete="current-password"
                        />
                      </div>
                      {loginError && <p className="text-sm text-red-400">{loginError}</p>}
                      <button
                        type="button"
                        onClick={handleInlineLogin}
                        disabled={loggingIn || !password}
                        className="w-full rounded-xl bg-blue-500 py-2.5 font-semibold text-white hover:bg-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {loggingIn ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {tPage('loggingIn')}
                          </>
                        ) : (
                          tPage('loginContinue')
                        )}
                      </button>
                      <a
                        href={`https://panel.innexar.app/${locale}/forgot-password`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-center text-xs text-slate-400 hover:text-blue-400 transition-colors"
                      >
                        {tPage('forgotPassword')}
                      </a>
                    </motion.div>
                  )}

                  <div>
                    <label htmlFor="checkout-name" className="mb-1 block text-sm font-medium text-slate-300">
                      {tCheckout('name')}
                    </label>
                    <input
                      id="checkout-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={tCheckout('namePlaceholder')}
                      className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      disabled={submitting}
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <label htmlFor="checkout-company" className="mb-1 block text-sm font-medium text-slate-300">
                      {tPage('companyName')}
                    </label>
                    <input
                      id="checkout-company"
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder={tPage('companyPlaceholder')}
                      className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      disabled={submitting}
                      autoComplete="organization"
                    />
                  </div>
                  <div>
                    <label htmlFor="checkout-phone" className="mb-1 block text-sm font-medium text-slate-300">
                      {tCheckout('phone')}
                    </label>
                    <input
                      id="checkout-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      disabled={submitting}
                      autoComplete="tel"
                    />
                  </div>
                  <div>
                    <label htmlFor="checkout-coupon" className="mb-1 block text-sm font-medium text-slate-300">
                      {tPage('couponCode')}
                    </label>
                    <input
                      id="checkout-coupon"
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      placeholder={tPage('couponPlaceholder')}
                      className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      disabled={submitting}
                    />
                  </div>

                  <div className="pt-2 pb-1">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={agreeTerms}
                        onChange={(e) => setAgreeTerms(e.target.checked)}
                        className="mt-1 w-5 h-5 rounded border-white/30 bg-white/5 text-blue-500 focus:ring-blue-400 focus:ring-offset-0 cursor-pointer"
                        disabled={submitting}
                      />
                      <span className="text-sm text-slate-300 group-hover:text-slate-200 transition-colors">
                        {tPage('termsAgreement')}{' '}
                        <a href={`/${locale}/terms-of-service`} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">
                          {tPage('termsLink')}
                        </a>
                      </span>
                    </label>
                    <label className="mt-3 flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={agreePrivacy}
                        onChange={(e) => setAgreePrivacy(e.target.checked)}
                        className="mt-1 w-5 h-5 rounded border-white/30 bg-white/5 text-blue-500 focus:ring-blue-400 focus:ring-offset-0 cursor-pointer"
                        disabled={submitting}
                      />
                      <span className="text-sm text-slate-300 group-hover:text-slate-200 transition-colors">
                        {tPage('privacyAgreement')}{' '}
                        <a href={`/${locale}/privacy-policy`} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">
                          {tPage('privacyLink')}
                        </a>
                      </span>
                    </label>
                  </div>

                  {error && <p className="text-sm text-red-400">{error}</p>}
                  <button
                    type="submit"
                    disabled={submitting || !agreeTerms || !agreePrivacy}
                    className="w-full rounded-xl bg-white py-3.5 font-bold text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {tCheckout('loading')}
                      </>
                    ) : (
                      tPage('continueToPayment')
                    )}
                  </button>
                </form>
              )}
            </motion.div>

            {plan && plansLoaded && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="md:col-span-2"
              >
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 sticky top-32">
                  <p className="text-sm text-slate-400 mb-1">Your plan</p>
                  <p className="text-xl font-bold text-white">{plan.name}</p>
                  <p className="text-3xl font-bold text-blue-400 mt-1">
                    ${plan.price}<span className="text-base font-normal text-slate-400">/mo</span>
                  </p>
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-sm text-slate-400 mb-2">Included</p>
                    <ul className="space-y-2">
                      {plan.includes.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-slate-300 text-sm">
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PaidTrafficCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PaidTrafficCheckoutContent />
    </Suspense>
  )
}

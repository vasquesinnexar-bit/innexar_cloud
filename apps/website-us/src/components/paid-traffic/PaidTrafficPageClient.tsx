'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Target, ArrowRight, AlertTriangle } from 'lucide-react'
import { Link, useRouter } from '@/i18n/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

const API_PAID_TRAFFIC_PRODUCTS = process.env.NEXT_PUBLIC_WORKSPACE_API_URL
  ? `${process.env.NEXT_PUBLIC_WORKSPACE_API_URL}/api/public/products/paid-traffic`
  : ''

type PaidTrafficPlan = {
  slug: string
  name: string
  price: number
  currency: string
  ideal_for: string
  includes: string[]
  goal: string
}

const FALLBACK_PLANS: PaidTrafficPlan[] = [
  {
    slug: 'start',
    name: 'Paid Traffic Start',
    price: 97,
    currency: 'USD',
    ideal_for: 'Businesses starting with paid ads and looking for their first clients',
    includes: [
      'Meta Ads management (Facebook & Instagram)',
      '1 campaign setup (lead generation)',
      'Up to 2 ad sets',
      'Audience targeting strategy',
      'Campaign setup and monitoring',
      'Basic monthly report',
    ],
    goal: 'Generate first leads and validate the business',
  },
  {
    slug: 'growth',
    name: 'Paid Traffic Growth',
    price: 197,
    currency: 'USD',
    ideal_for: 'Businesses ready to grow and increase customer flow',
    includes: [
      'Full Meta Ads management',
      'Up to 3 campaigns (lead generation, engagement, remarketing)',
      'Up to 5 ad sets',
      'A/B testing',
      'Weekly optimization',
      'Performance analysis and improvements',
      'Detailed report with insights',
    ],
    goal: 'Increase conversions and scale results',
  },
  {
    slug: 'premium',
    name: 'Paid Traffic Premium',
    price: 397,
    currency: 'USD',
    ideal_for: 'Businesses that want consistent leads and strong market presence',
    includes: [
      'Advanced traffic management (Meta Ads + Google Ads)',
      'Full funnel strategy',
      'Advanced remarketing',
      'Custom strategy development',
      'Continuous optimization',
      'Performance tracking and scaling',
      'Full reports + strategy call',
      'Priority support',
    ],
    goal: 'Maximize revenue and scale aggressively',
  },
]

const BADGES: Record<string, { label: string; color: string }> = {
  start: { label: 'START PLAN', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  growth: { label: 'GROWTH PLAN', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  premium: { label: 'PREMIUM PLAN', color: 'bg-rose-100 text-rose-800 border-rose-300' },
}

export default function PaidTrafficPageClient() {
  const router = useRouter()
  const [plans, setPlans] = useState<PaidTrafficPlan[]>(FALLBACK_PLANS)
  const [isCheckingOut, setIsCheckingOut] = useState<string | null>(null)

  const handleStartPlan = (planSlug: string) => {
    setIsCheckingOut(planSlug)
    router.push(`/paid-traffic/checkout?plan=${encodeURIComponent(planSlug)}`)
  }

  useEffect(() => {
    if (!API_PAID_TRAFFIC_PRODUCTS) return
    fetch(API_PAID_TRAFFIC_PRODUCTS)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PaidTrafficPlan[] | null) => {
        if (Array.isArray(data) && data.length > 0) {
          setPlans(data)
        }
      })
      .catch(() => {
        // keep fallback
      })
  }, [])

  return (
    <main className="min-h-screen bg-linear-to-b from-[#f4fbff] via-white to-[#f2f8ff] text-slate-900">
      <Header />

      <section className="relative overflow-hidden pt-[150px] pb-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(34,211,238,0.18),transparent_40%)]" />
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <span className="inline-flex rounded-full border border-cyan-300 bg-cyan-50 px-3 py-1 text-xs font-semibold tracking-wider text-cyan-800">
              PAID TRAFFIC PLANS
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight text-slate-950 md:text-6xl">
              Paid Traffic That Converts Into Pipeline
            </h1>
            <p className="mt-4 text-lg text-slate-700">
              Choose the right plan for your business stage and scale your lead generation with strategy, execution and continuous optimization.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/paid-traffic/checkout?plan=start"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg"
              >
                Start with Start Plan
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700"
              >
                Talk to a Strategist
              </Link>
            </div>
          </motion.div>

          <div className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm leading-relaxed">
                <strong>Important:</strong> Ad spend (Facebook, Instagram, Google) is not included in the plans.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {plans.map((plan, index) => {
              const badge = BADGES[plan.slug] ?? BADGES.start
              return (
                <motion.article
                  key={plan.slug}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_22px_55px_-38px_rgba(15,23,42,0.65)]"
                >
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold tracking-wider ${badge.color}`}>
                    {badge.label}
                  </span>
                  <h2 className="mt-4 text-2xl font-bold text-slate-900">{plan.name}</h2>
                  <p className="mt-3 text-4xl font-extrabold text-slate-900">${plan.price}<span className="text-base font-medium text-slate-500">/month</span></p>

                  <div className="mt-6">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Ideal for</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">{plan.ideal_for}</p>
                  </div>

                  <div className="mt-6">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Includes</h3>
                    <ul className="mt-3 space-y-2 text-sm text-slate-700">
                      {plan.includes.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-800">
                      <Target className="h-4 w-4" /> Goal
                    </p>
                    <p className="mt-1 text-sm text-cyan-900">{plan.goal}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleStartPlan(plan.slug)}
                    disabled={isCheckingOut === plan.slug}
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-bold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCheckingOut === plan.slug ? 'Redirecting...' : 'Start this plan'}
                    {isCheckingOut !== plan.slug && <ArrowRight className="h-4 w-4" />}
                  </button>
                </motion.article>
              )
            })}
          </div>

          <div className="mt-12 flex flex-col items-start gap-3 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Ready to scale your paid traffic?</h3>
              <p className="mt-1 text-slate-600">Talk to our team and start with the ideal strategy for your current stage.</p>
            </div>
            <Link
              href="/paid-traffic/checkout?plan=start"
              className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-bold text-white hover:opacity-95"
            >
              Start with Start Plan
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}

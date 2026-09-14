'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRightIcon, CheckBadgeIcon } from '@heroicons/react/24/outline'
import { Link } from '@/i18n/navigation'

const CODE_LINES = [
  "const project = createProject({",
  "  industry: 'legal',",
  "  objective: 'generate-qualified-leads',",
  "  integrations: ['crm', 'analytics', 'whatsapp'],",
  "  locale: 'multilingual',",
  "})",
  '',
  'project.applyBrand({',
  "  colors: ['#0f172a', '#0891b2'],",
  "  voice: 'premium-and-clear',",
  '})',
  '',
  'project.deploy({',
  "  channel: 'web + campaigns',",
  "  target: '7-days',",
  '})',
] as const

export default function BuildToUiSection() {
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    if (visibleCount >= CODE_LINES.length) return
    const timer = setTimeout(() => {
      setVisibleCount((prev) => prev + 1)
    }, 105)

    return () => clearTimeout(timer)
  }, [visibleCount])

  const visibleLines = useMemo(() => CODE_LINES.slice(0, visibleCount), [visibleCount])

  return (
    <section className="relative overflow-hidden bg-linear-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-24 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(34,211,238,0.28),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(59,130,246,0.24),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(34,211,238,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.16)_1px,transparent_1px)] [background-size:54px_54px]" />

      <div className="relative mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10 max-w-3xl"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/70 bg-cyan-100/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-900">
            Live Build Experience
          </span>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight text-white sm:text-5xl">
            From strategic code to a production-ready interface
          </h2>
          <p className="mt-4 text-lg text-slate-300">
            Every project is built like a product: strategy, implementation, optimization, and a launch path with clear business goals.
          </p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -4 }}
            className="min-w-0 overflow-hidden rounded-3xl border border-cyan-200/30 bg-slate-950 p-6 text-slate-100 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
              </div>
              <span className="text-xs text-slate-400">innexar.build.ts</span>
            </div>

            <pre className="min-h-[330px] max-w-full overflow-x-auto rounded-2xl border border-white/10 bg-slate-900 p-4 text-xs leading-relaxed sm:text-sm">
              <code>
                {visibleLines.map((line, index) => (
                  <div key={`${line}-${index}`} className="text-slate-200">
                    <span className="mr-3 text-slate-500">{String(index + 1).padStart(2, '0')}</span>
                    {line}
                  </div>
                ))}
                {visibleCount < CODE_LINES.length ? <span className="animate-pulse text-cyan-300">|</span> : null}
              </code>
            </pre>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            viewport={{ once: true }}
            whileHover={{ y: -4 }}
            className="min-w-0 overflow-hidden rounded-3xl border border-cyan-100 bg-white p-6 shadow-[0_35px_70px_-45px_rgba(15,23,42,0.65)]"
          >
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Live Preview</h3>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Ready to Launch</span>
              </div>

              <div className="mt-4 grid gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Hero conversion block</p>
                  <p className="mt-2 text-xl font-bold text-slate-900">Professional website with clear offer and CTA</p>
                  <div className="mt-4 flex gap-2">
                    <span className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white">Book strategy call</span>
                    <span className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">View portfolio</span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 }}
                    viewport={{ once: true }}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <p className="text-sm font-semibold text-slate-900">Performance setup</p>
                    <p className="mt-1 text-sm text-slate-600">SEO, analytics, and event tracking configured from day one.</p>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    viewport={{ once: true }}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <p className="text-sm font-semibold text-slate-900">Sales workflow</p>
                    <p className="mt-1 text-sm text-slate-600">Lead capture, qualification, and CRM integration included.</p>
                  </motion.div>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {[
                'Clear messaging aligned with your business model',
                'Responsive interface optimized for desktop and mobile',
                'Fast launch with guided implementation process',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm text-slate-700">
                  <CheckBadgeIcon className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <Link
              href="/contact"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md transition-transform hover:scale-[1.02]"
            >
              Start my build now
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

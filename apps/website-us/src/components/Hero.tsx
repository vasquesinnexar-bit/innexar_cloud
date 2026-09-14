'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { ArrowRightIcon, PlayCircleIcon } from '@heroicons/react/24/outline'
import { Link } from '@/i18n/navigation'

const Hero = () => {
  const t = useTranslations('hero')
  const rawMetrics = t.raw('metrics')
  const [ready, setReady] = useState(false)
  const [isGlobeActive, setIsGlobeActive] = useState(false)
  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)
  const springX = useSpring(rotateX, { stiffness: 120, damping: 16, mass: 0.8 })
  const springY = useSpring(rotateY, { stiffness: 120, damping: 16, mass: 0.8 })

  const metrics = Array.isArray(rawMetrics)
    ? (rawMetrics as { value: string; label: string }[])
    : []

  useEffect(() => {
    queueMicrotask(() => setReady(true))
  }, [])

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isGlobeActive) setIsGlobeActive(true)

    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height

    rotateY.set((x - 0.5) * 18)
    rotateX.set((0.5 - y) * 18)
  }

  const onPointerLeave = () => {
    setIsGlobeActive(false)
    rotateX.set(0)
    rotateY.set(0)
  }

  const coreSpinDuration = isGlobeActive ? 10 : 26
  const orbitFastDuration = isGlobeActive ? 4.5 : 12
  const orbitSlowDuration = isGlobeActive ? 7.5 : 18

  return (
    <section className="relative isolate overflow-hidden bg-linear-to-b from-[#f2fbff] via-white to-[#eef7ff] text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_15%_0%,rgba(6,182,212,0.18),transparent_58%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_90%_10%,rgba(59,130,246,0.16),transparent_60%)]" />
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(14,116,144,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(14,116,144,0.08)_1px,transparent_1px)] [background-size:56px_56px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-36 sm:px-6 lg:px-8 lg:pb-20 lg:pt-42">
        <div className="grid items-center gap-10 lg:grid-cols-12">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : 18 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/70 bg-cyan-100/70 px-4 py-1.5 text-sm font-semibold text-cyan-900">
              {t('badge')}
            </span>

            <h1 className="mt-6 text-4xl font-extrabold leading-tight text-slate-950 md:text-6xl">
              {t('title')}{' '}
              <span className="bg-linear-to-r from-cyan-600 to-blue-700 bg-clip-text text-transparent">
                {t('highlight')}
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-700 md:text-xl">
              {t('subtitle')}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-cyan-500 to-blue-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-cyan-500/20 transition-transform hover:scale-[1.01]"
              >
                {t('primaryCta')}
                <ArrowRightIcon className="h-5 w-5" />
              </Link>
              <Link
                href="/portfolio"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-white px-7 py-3.5 text-base font-semibold text-slate-800 transition-colors hover:border-cyan-400 hover:bg-cyan-50"
              >
                <PlayCircleIcon className="h-5 w-5" />
                {t('secondaryCta')}
              </Link>
            </div>

            <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-slate-500">
              {t('coverage')}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : 22 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="lg:col-span-5"
          >
            <div
              className="group relative overflow-hidden rounded-3xl border border-cyan-100 bg-white/90 p-6 shadow-[0_30px_80px_-45px_rgba(8,145,178,0.55)] backdrop-blur"
              onPointerMove={onPointerMove}
              onPointerLeave={onPointerLeave}
            >
              <motion.div
                style={{ rotateX: springX, rotateY: springY, transformStyle: 'preserve-3d' }}
                className="relative mx-auto mb-6 h-64 w-64"
              >
                <motion.div
                  className="absolute inset-0"
                  animate={{ rotate: 360 }}
                  transition={{ duration: coreSpinDuration, repeat: Infinity, ease: 'linear' }}
                >
                  <div className="absolute inset-0 rounded-full border border-cyan-300/50 bg-[radial-gradient(circle_at_30%_30%,#67e8f9_0%,#0ea5e9_40%,#1e3a8a_72%,#0f172a_100%)] shadow-[inset_0_8px_30px_rgba(255,255,255,0.45),0_25px_60px_-25px_rgba(14,116,144,0.8)]" />
                  <div className="absolute inset-1 rounded-full opacity-75 [background:conic-gradient(from_120deg,rgba(34,211,238,0.32),rgba(59,130,246,0.08),rgba(34,211,238,0.45),rgba(29,78,216,0.12),rgba(34,211,238,0.32))]" />
                </motion.div>

                <div className="absolute inset-5 rounded-full border border-cyan-100/60" />
                <div className="absolute inset-11 rounded-full border border-cyan-100/40" />

                <div className="absolute -inset-8 animate-spin-slow rounded-full border border-cyan-300/35" />
                <div className="absolute -inset-14 animate-spin-reverse rounded-full border border-blue-300/25" />

                <motion.div
                  className="absolute inset-0"
                  animate={{ rotate: 360 }}
                  transition={{ duration: orbitFastDuration, repeat: Infinity, ease: 'linear' }}
                >
                  <div className="absolute left-1/2 top-2 h-3 w-3 -translate-x-1/2 rounded-full bg-cyan-100 shadow-[0_0_24px_rgba(103,232,249,0.9)]" />
                </motion.div>

                <motion.div
                  className="absolute inset-0"
                  animate={{ rotate: -360 }}
                  transition={{ duration: orbitSlowDuration, repeat: Infinity, ease: 'linear' }}
                >
                  <div className="absolute bottom-3 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-blue-100 shadow-[0_0_20px_rgba(147,197,253,0.95)]" />
                </motion.div>

                <div className="absolute left-8 top-10 h-3 w-3 rounded-full bg-cyan-100 shadow-[0_0_30px_rgba(103,232,249,0.9)]" />
                <div className="absolute right-12 top-20 h-2.5 w-2.5 rounded-full bg-blue-100 shadow-[0_0_24px_rgba(147,197,253,0.95)]" />
                <div className="absolute bottom-12 left-16 h-2 w-2 rounded-full bg-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.75)]" />
              </motion.div>

              <h2 className="text-xs font-semibold uppercase tracking-widest text-cyan-700">
                {t('outcome.title')}
              </h2>
              <p className="mt-3 text-lg font-semibold leading-snug text-slate-900">{t('outcome.subtitle')}</p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                {metrics.map((metric) => (
                  <div key={metric.label} className="rounded-xl border border-cyan-100 bg-cyan-50/60 px-4 py-4">
                    <div className="text-2xl font-extrabold text-slate-900">{metric.value}</div>
                    <div className="mt-0.5 text-xs text-slate-600">{metric.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default Hero

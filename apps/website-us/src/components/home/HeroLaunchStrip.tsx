'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { motion } from 'framer-motion'
import { ArrowRight, Check, Rocket, Sparkles } from 'lucide-react'

const BULLET_KEYS = ['bullet1', 'bullet2', 'bullet3', 'bullet4'] as const

export function HeroLaunchStrip() {
  const t = useTranslations('home.newSystem')

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.85 }}
      className="mt-8 rounded-2xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur-md"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-200">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t('badge')}
          </span>
          <p className="max-w-xl text-sm font-medium leading-snug text-slate-100">{t('title')}</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-300">
            {BULLET_KEYS.map((key) => (
              <li key={key} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Link
            href="/launch"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 shadow-lg transition-transform hover:scale-[1.02]"
          >
            <Rocket className="h-4 w-4" aria-hidden />
            {t('cta')}
          </Link>
          <Link
            href="/launch#plans"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            {t('ctaSecondary')}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'

const TAB_KEYS = ['stack', 'cloud', 'ai', 'tooling'] as const
type TabKey = (typeof TAB_KEYS)[number]

// Map technology names to brand colors and emoji/icon indicators
const TECH_BRAND: Record<string, { color: string; accent: string; icon: string }> = {
  // Frontend / Apps
  'Next.js 14 / React 18': { color: 'from-black to-gray-800', accent: 'text-white', icon: '⚛️' },
  TypeScript: { color: 'from-blue-600 to-blue-700', accent: 'text-blue-100', icon: '🔷' },
  'Tailwind CSS': { color: 'from-cyan-500 to-teal-500', accent: 'text-cyan-100', icon: '💨' },
  'Framer Motion': { color: 'from-purple-600 to-pink-500', accent: 'text-purple-100', icon: '✨' },
  Storybook: { color: 'from-pink-500 to-rose-500', accent: 'text-pink-100', icon: '📖' },
  'Vercel Edge': { color: 'from-gray-800 to-gray-900', accent: 'text-gray-100', icon: '▲' },
  // Cloud
  'Google Cloud Platform': { color: 'from-blue-500 to-red-400', accent: 'text-blue-100', icon: '☁️' },
  'Amazon Web Services': { color: 'from-orange-500 to-yellow-500', accent: 'text-orange-100', icon: '🟠' },
  'Microsoft Azure': { color: 'from-blue-500 to-cyan-400', accent: 'text-blue-100', icon: '🔵' },
  Kubernetes: { color: 'from-blue-600 to-blue-500', accent: 'text-blue-100', icon: '☸️' },
  Docker: { color: 'from-blue-500 to-sky-400', accent: 'text-sky-100', icon: '🐳' },
  Terraform: { color: 'from-purple-600 to-indigo-500', accent: 'text-purple-100', icon: '🏗️' },
  // AI
  'OpenAI GPT-4 / GPT-4o': { color: 'from-emerald-500 to-teal-500', accent: 'text-emerald-100', icon: '🧠' },
  'Vertex AI': { color: 'from-blue-500 to-indigo-500', accent: 'text-blue-100', icon: '🤖' },
  LangChain: { color: 'from-green-600 to-emerald-500', accent: 'text-green-100', icon: '🔗' },
  BigQuery: { color: 'from-blue-600 to-blue-400', accent: 'text-blue-100', icon: '📊' },
  Pinecone: { color: 'from-teal-500 to-cyan-400', accent: 'text-teal-100', icon: '🌲' },
  dbt: { color: 'from-orange-500 to-red-400', accent: 'text-orange-100', icon: '🔄' },
  // Tooling
  'GitHub Actions': { color: 'from-gray-800 to-gray-700', accent: 'text-gray-100', icon: '⚙️' },
  Sentry: { color: 'from-purple-700 to-purple-500', accent: 'text-purple-100', icon: '🛡️' },
  Datadog: { color: 'from-violet-600 to-purple-500', accent: 'text-violet-100', icon: '📈' },
  SonarQube: { color: 'from-blue-500 to-cyan-500', accent: 'text-blue-100', icon: '🔍' },
  Playwright: { color: 'from-green-600 to-green-400', accent: 'text-green-100', icon: '🎭' },
  'Grafana + Prometheus': { color: 'from-orange-500 to-yellow-400', accent: 'text-orange-100', icon: '📉' },
}

const DEFAULT_BRAND = { color: 'from-indigo-500 to-cyan-500', accent: 'text-indigo-100', icon: '💻' }

function TechCard({ name }: { name: string }) {
  const brand = TECH_BRAND[name] || DEFAULT_BRAND

  return (
    <motion.div
      whileHover={{ scale: 1.04, y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.07] p-5 backdrop-blur-sm"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${brand.color} opacity-0 transition-opacity duration-300 group-hover:opacity-15`} />
      <div className="relative flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${brand.color} text-lg shadow-lg`}>
          {brand.icon}
        </div>
        <p className="text-sm font-semibold text-white">{name}</p>
      </div>
    </motion.div>
  )
}

const Technologies = () => {
  const t = useTranslations('technologies')
  const [active, setActive] = useState<TabKey>('stack')

  const stackItems = t.raw('stack.items') as string[]
  const cloudItems = t.raw('cloud.items') as string[]
  const aiItems = t.raw('ai.items') as string[]
  const toolingItems = t.raw('tooling.items') as string[]

  const sections: Record<
    TabKey,
    { title: string; description: string; items: string[] }
  > = {
    stack: {
      title: t('stack.title'),
      description: t('stack.description'),
      items: stackItems,
    },
    cloud: {
      title: t('cloud.title'),
      description: t('cloud.description'),
      items: cloudItems,
    },
    ai: {
      title: t('ai.title'),
      description: t('ai.description'),
      items: aiItems,
    },
    tooling: {
      title: t('tooling.title'),
      description: t('tooling.description'),
      items: toolingItems,
    },
  }

  const current = sections[active]

  return (
    <section className="relative overflow-hidden bg-linear-to-br from-slate-950 via-slate-900 to-indigo-950 py-24">
      <div className="pointer-events-none absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.35),transparent_55%),radial-gradient(circle_at_80%_40%,rgba(34,211,238,0.2),transparent_50%)]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: '-80px' }}
          className="text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 shadow-sm backdrop-blur">{t('badge')}</span>
          <h2 className="mt-6 text-4xl font-bold text-white md:text-5xl">{t('title')}</h2>
          <p className="mx-auto mt-4 max-w-3xl text-lg text-slate-300 md:text-xl">{t('subtitle')}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          viewport={{ once: true }}
          className="mt-10 flex flex-wrap justify-center gap-2"
          role="tablist"
          aria-label={t('tabsHint')}
        >
          {TAB_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active === key}
              onClick={() => setActive(key)}
              className={`rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                active === key
                  ? 'bg-linear-to-r from-violet-500 to-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                  : 'border border-white/15 bg-white/5 text-slate-300 hover:border-white/25 hover:bg-white/10'
              }`}
            >
              {t(`tabs.${key}`)}
            </button>
          ))}
        </motion.div>

        <div className="mt-10 min-h-[280px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              role="tabpanel"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="rounded-3xl border border-white/15 bg-white/[0.06] p-8 shadow-2xl backdrop-blur-md md:p-10"
            >
              <div className="mb-8 text-center md:mb-10 md:text-left">
                <h3 className="text-2xl font-semibold text-white">{current.title}</h3>
                <p className="mt-2 max-w-2xl text-slate-300 md:mx-0">
                  {current.description}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {current.items.map((item, index) => (
                  <motion.div
                    key={item}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <TechCard name={item} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mt-14 text-center text-lg text-slate-300"
        >
          {t('cta')}
        </motion.p>
      </div>
    </section>
  )
}

export default Technologies

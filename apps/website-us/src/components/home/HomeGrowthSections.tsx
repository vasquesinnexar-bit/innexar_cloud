"use client"

import { ArrowTrendingUpIcon, BoltIcon, CommandLineIcon, RocketLaunchIcon } from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'
import { Link } from '@/i18n/navigation'

const PILLARS = [
  {
    title: 'Conversion-first positioning',
    description: 'We design the message so visitors understand your value in seconds and move to action with confidence.',
    icon: CommandLineIcon,
  },
  {
    title: 'Execution speed with quality',
    description: 'Short cycles, direct communication, and delivery discipline so your business can launch and iterate faster.',
    icon: BoltIcon,
  },
  {
    title: 'Scalable growth architecture',
    description: 'From landing pages to complete product experiences, your website structure grows with your operation.',
    icon: ArrowTrendingUpIcon,
  },
  {
    title: 'Launch support and iteration',
    description: 'After go-live, we track behavior and refine flows to improve acquisition and conversion month over month.',
    icon: RocketLaunchIcon,
  },
]

export default function HomeGrowthSections() {
  return (
    <>
      <section className="bg-white px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl"
          >
            <h2 className="text-3xl font-extrabold leading-tight text-slate-950 sm:text-5xl">
              Clean interface, strong positioning, and clear CTA flow
            </h2>
            <p className="mt-4 text-lg text-slate-700">
              Innexar is built to be your premium showcase while still acting as a sales engine for real opportunities.
            </p>
          </motion.div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {PILLARS.map((pillar, index) => (
              <motion.article
                key={pillar.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.55)]"
              >
                <div className="inline-flex rounded-xl bg-cyan-50 p-2.5 text-cyan-700">
                  <pillar.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-xl font-bold text-slate-900">{pillar.title}</h3>
                <p className="mt-2 text-slate-600">{pillar.description}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-4 pb-24 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_0%,rgba(8,145,178,0.18),transparent_46%)]" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          whileHover={{ scale: 1.005 }}
          className="relative mx-auto max-w-7xl rounded-3xl border border-cyan-100 bg-linear-to-r from-cyan-600 to-blue-700 p-8 text-white shadow-[0_30px_75px_-40px_rgba(8,145,178,0.7)] sm:p-12"
        >
          <div className="grid items-center gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">Launch with Clarity</p>
              <h3 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">Turn your next website into your strongest sales asset</h3>
              <p className="mt-3 text-cyan-50/95">
                Clear offer, premium visual language, and conversion-ready structure built around your business goals.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-cyan-800 transition-transform hover:scale-[1.02]"
              >
                Book a Strategy Call
              </Link>
              <Link
                href="/launch"
                className="inline-flex items-center justify-center rounded-xl border border-white/60 px-6 py-3 text-sm font-bold text-white transition-transform hover:scale-[1.02]"
              >
                See Launch Plans
              </Link>
            </div>
          </div>
        </motion.div>
      </section>
    </>
  )
}

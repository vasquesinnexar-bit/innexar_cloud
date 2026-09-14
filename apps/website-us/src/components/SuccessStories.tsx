'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { ArrowUpRightIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { asArray } from '@/lib/as-array'

type CaseStudy = {
  name: string
  industry: string
  image: string
  images?: string[]
  site: string
  challenge: string
  solution: string
  results: string[]
}

type SiteLink = {
  label: string
  url: string
}

const CASE_IMAGE_OVERRIDES: Record<string, string[]> = {
  ProspectorAI: ['/portfolio/propector.png'],
  Fixelo: ['/portfolio/fixelo.png'],
  'Dunna App': [
    '/portfolio/dunnaapp01.png',
    '/portfolio/dunnaapp02.png',
    '/portfolio/dunnaapp03.png',
  ],
  'Innexar Workspace': ['/portfolio/workspace.png'],
  'Innexar WaaS': ['/portfolio/waas01.png', '/portfolio/waas02.png'],
}

function CaseImageCarousel({ images, name, site }: { images: string[]; name: string; site: string }) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    setActiveIndex(0)
  }, [images])

  useEffect(() => {
    if (images.length <= 1) return

    const timer = globalThis.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % images.length)
    }, 3200)

    return () => globalThis.clearInterval(timer)
  }, [images])

  return (
    <a
      href={site}
      target="_blank"
      rel="noreferrer"
      className="block overflow-hidden rounded-2xl border border-white/10"
    >
      <div className="relative">
        <Image
          src={images[activeIndex]}
          alt={`${name} screenshot ${activeIndex + 1}`}
          width={640}
          height={360}
          className="h-44 w-full object-cover transition-opacity duration-500"
        />

        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/35 px-2 py-1">
            {images.map((img, idx) => (
              <span
                key={`${img}-${idx}`}
                className={`h-1.5 w-1.5 rounded-full ${idx === activeIndex ? 'bg-white' : 'bg-white/45'}`}
              />
            ))}
          </div>
        )}
      </div>
    </a>
  )
}

const SuccessStories = () => {
  const t = useTranslations('successStories')
  const cases = asArray<CaseStudy>(t.raw('cases'))
  const siteLinks = asArray<SiteLink>(t.raw('siteLinks'))

  const casesWithImages = useMemo(() => {
    return cases.map((item) => {
      const translatedImages = Array.isArray(item.images) && item.images.length > 0 ? item.images : []
      const overrideImages = CASE_IMAGE_OVERRIDES[item.name] ?? []
      const fallbackImages = item.image ? [item.image] : []
      const images = [...overrideImages, ...translatedImages, ...fallbackImages]

      return {
        ...item,
        images: images.length > 0 ? images : ['/portfolio/e-commerce.png'],
      }
    })
  }, [cases])

  return (
    <section id="portfolio" className="py-24 bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="max-w-3xl text-center mx-auto"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-cyan-200">
            {t('eyebrow')}
          </span>
          <h2 className="mt-6 text-4xl md:text-5xl font-bold text-white">
            {t('title')}
          </h2>
          <p className="mt-4 text-lg text-slate-200 leading-relaxed">
            {t('subtitle')}
          </p>
        </motion.div>

        <div className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-10">
          {casesWithImages.map((item, index) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: index * 0.08 }}
              viewport={{ once: true }}
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-8 backdrop-blur-lg shadow-xl shadow-cyan-500/10"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-cyan-600/[0.12]" />
              <div className="relative flex flex-col h-full">
                <CaseImageCarousel images={item.images} name={item.name} site={item.site} />

                <div className="mt-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-cyan-200/80">
                      {item.industry}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">
                      {item.name}
                    </h3>
                  </div>
                  <a
                    href={item.site}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-cyan-300/40 px-3 py-1 text-xs font-semibold text-cyan-200 hover:border-cyan-200"
                  >
                    {t('visitSite')}
                    <ArrowUpRightIcon className="h-4 w-4" />
                  </a>
                </div>

                <div className="mt-6 space-y-4 text-sm text-slate-200/80 leading-relaxed">
                  <p>
                    <span className="font-semibold text-white">{t('challenge')}</span>{' '}
                    {item.challenge}
                  </p>
                  <p>
                    <span className="font-semibold text-white">{t('solution')}</span>{' '}
                    {item.solution}
                  </p>
                </div>

                <div className="mt-6 pt-6 border-t border-white/10">
                  <p className="text-xs font-semibold uppercase tracking-widest text-cyan-200">
                    {t('results')}
                  </p>
                  <ul className="mt-4 space-y-3 text-sm text-slate-100">
                    {item.results.map((result) => (
                      <li key={result} className="flex gap-2">
                        <span className="mt-1 h-2 w-2 rounded-full bg-cyan-400/90" />
                        <span>{result}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          viewport={{ once: true }}
          className="mt-14 rounded-3xl border border-white/10 bg-white/[0.04] p-8"
        >
          <p className="text-sm font-semibold uppercase tracking-widest text-cyan-200">
            {t('siteListTitle')}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {siteLinks.map((item) => (
              <a
                key={item.url}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-4 py-2 text-sm text-slate-100 transition-colors hover:border-cyan-300/70 hover:text-white"
              >
                {item.label}
                <ArrowUpRightIcon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <a
            href={t('ctaLink')}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white/90 transition-all duration-300 hover:border-cyan-400/60 hover:text-white hover:bg-white/10"
          >
            {t('cta')}
            <ArrowUpRightIcon className="h-4 w-4" />
          </a>
        </motion.div>
      </div>
    </section>
  )
}

export default SuccessStories


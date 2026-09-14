'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { Link, usePathname } from '@/i18n/navigation'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bars3Icon,
  XMarkIcon,
  ChevronDownIcon,
  GlobeAltIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline'

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
]

const SCROLL_THRESHOLD_PX = 16

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
  const [companyOpen, setCompanyOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const companyRef = useRef<HTMLDivElement>(null)
  const t = useTranslations('navigation')
  const companyT = useTranslations('navigation.companyMenu')
  const headerT = useTranslations('header')
  const locale = useLocale()
  const pathname = usePathname()
  const isHome = pathname === '/'

  const primaryNav: { key: string; name: string; href: string; highlight?: boolean }[] = [
    { key: 'home', name: t('home'), href: '/' },
    { key: 'services', name: t('services'), href: '/services' },
    { key: 'paidTraffic', name: t('paidTraffic'), href: '/paid-traffic' },
    { key: 'portfolio', name: t('portfolio'), href: '/portfolio' },
    { key: 'launch', name: t('newWebsiteSystem'), href: '/launch', highlight: true },
    { key: 'contact', name: t('contact'), href: '/contact' },
  ]

  const companyLinks = [
    { key: 'about', name: companyT('about'), href: '/about' },
    { key: 'blockchain', name: companyT('blockchain'), href: '/blockchain' },
    { key: 'saas', name: companyT('saas'), href: '/saas' },
  ]

  const currentLanguage = languages.find((lang) => lang.code === locale) || languages[0]
  const topEmailValue = headerT('top.emailValue')
  const topCta = headerT('top.cta')
  const portalNewProjectUrl = `https://panel.innexar.app/${locale}/new-project`

  useLayoutEffect(() => {
    const onScroll = () => {
      if (!isHome) {
        setScrolled(true)
        return
      }
      setScrolled(window.scrollY > SCROLL_THRESHOLD_PX)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isHome])

  useEffect(() => {
    const closeOnOutside = (e: MouseEvent) => {
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) {
        setCompanyOpen(false)
      }
    }
    document.addEventListener('click', closeOnOutside)
    return () => document.removeEventListener('click', closeOnOutside)
  }, [])

  const changeLanguage = (newLocale: string) => {
    setLanguageMenuOpen(false)
    setMobileMenuOpen(false)
    const currentPath = globalThis.location?.pathname || '/'
    const pathWithoutLocale = currentPath.replace(`/${locale}`, '') || '/'
    const newPath = `/${newLocale}${pathWithoutLocale}`
    globalThis.location?.assign(newPath)
  }

  const navShellClass = scrolled
    ? 'border-b border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-2xl'
    : 'border-b border-slate-200/50 bg-white/70 backdrop-blur-2xl'

  const linkBase = 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-800'

  const logoSrc = '/logo-header.png'

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="hidden border-b border-cyan-200/40 bg-linear-to-r from-cyan-50 via-white to-blue-50 text-sm text-slate-700 lg:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
          <Link href="/contact" className="flex items-center gap-2 transition-colors hover:text-cyan-700">
            <EnvelopeIcon className="h-4 w-4" />
            <span>{topEmailValue}</span>
          </Link>
          <a
            href={portalNewProjectUrl}
            className="rounded-full border border-cyan-300/50 bg-white/90 px-4 py-1.5 text-xs font-semibold text-cyan-800 transition-colors hover:bg-cyan-100"
          >
            {topCta}
          </a>
        </div>
      </div>

      <div className={`relative transition-all duration-300 ${navShellClass}`}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(6,182,212,0.15),transparent_35%)]" />
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative flex h-[82px] items-center justify-between gap-4">
            <div className="flex h-full shrink-0 items-center">
              <Link href="/" className="group flex h-full items-center">
                <Image
                  src={logoSrc}
                  alt="Innexar"
                  width={260}
                  height={72}
                  className={`w-auto object-contain object-left transition-all duration-300 group-hover:opacity-90 ${
                    isHome ? 'h-[62px] sm:h-[66px]' : 'h-12 sm:h-14'
                  }`}
                  priority
                />
              </Link>
            </div>

            <div className="hidden items-center gap-1 rounded-2xl border border-slate-200/70 bg-white/75 p-1.5 shadow-[0_10px_35px_-20px_rgba(15,23,42,0.5)] lg:flex">
              {primaryNav.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className={
                    item.highlight
                      ? 'relative rounded-xl bg-linear-to-r from-cyan-500 to-blue-600 px-3.5 py-2 text-sm font-bold text-white shadow-md transition-transform hover:scale-[1.02]'
                      : `relative rounded-xl px-4 py-2 text-sm font-medium transition-colors ${linkBase}`
                  }
                >
                  {item.highlight ? <span className="mr-1">New</span> : null}
                  {item.name}
                </Link>
              ))}

              <div className="relative" ref={companyRef}>
                <button
                  type="button"
                  onClick={() => setCompanyOpen(!companyOpen)}
                  className={`flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${linkBase}`}
                  aria-expanded={companyOpen}
                  aria-haspopup="true"
                >
                  {companyT('label')}
                  <ChevronDownIcon className={`h-4 w-4 transition ${companyOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {companyOpen ? (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="absolute right-0 z-50 mt-2 min-w-[220px] rounded-xl border border-slate-200 bg-white/95 py-2 shadow-xl backdrop-blur"
                    >
                      {companyLinks.map((link) => (
                        <Link
                          key={link.key}
                          href={link.href}
                          className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-cyan-50 hover:text-cyan-700"
                          onClick={() => setCompanyOpen(false)}
                        >
                          {link.name}
                        </Link>
                      ))}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>

            <div className="hidden flex-1 items-center justify-end gap-3 lg:flex">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${linkBase}`}
                >
                  <GlobeAltIcon className="h-5 w-5" />
                  <span>{currentLanguage.flag}</span>
                  <span className="uppercase">{currentLanguage.code}</span>
                  <ChevronDownIcon className="h-4 w-4" />
                </button>
                <AnimatePresence>
                  {languageMenuOpen ? (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 mt-2 w-48 rounded-lg border border-slate-200 bg-white/95 py-2 shadow-xl backdrop-blur"
                    >
                      {languages.map((lang) => (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => changeLanguage(lang.code)}
                          className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-cyan-50 hover:text-cyan-700"
                        >
                          <span>{lang.flag}</span>
                          <span>{lang.name}</span>
                        </button>
                      ))}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <a
                href="https://panel.innexar.app"
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-cyan-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                {t('portal')}
              </a>

              <a
                href={portalNewProjectUrl}
                className="rounded-xl bg-linear-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-cyan-600 hover:to-blue-700 hover:shadow-md"
              >
                {t('getStarted')}
              </a>
            </div>

            <div className="flex lg:hidden">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg p-2.5 text-slate-700 hover:bg-slate-100"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <span className="sr-only">Toggle menu</span>
                {mobileMenuOpen ? (
                  <XMarkIcon className="h-6 w-6" aria-hidden />
                ) : (
                  <Bars3Icon className="h-6 w-6" aria-hidden />
                )}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {mobileMenuOpen ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden lg:hidden"
              >
                <div className="space-y-1 pb-4 pt-2">
                  {primaryNav.map((item) => (
                    <Link
                      key={item.key}
                      href={item.href}
                      className="block rounded-lg px-4 py-3 text-base font-medium text-gray-700 hover:bg-cyan-50 hover:text-cyan-700"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.name}
                    </Link>
                  ))}
                  <p className="px-4 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {companyT('label')}
                  </p>
                  {companyLinks.map((link) => (
                    <Link
                      key={link.key}
                      href={link.href}
                      className="block rounded-lg px-4 py-2.5 text-base font-medium text-gray-700 hover:bg-cyan-50 hover:text-cyan-700"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {link.name}
                    </Link>
                  ))}

                  <div className="space-y-2 border-t border-gray-200 pt-4">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => changeLanguage(lang.code)}
                        className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors ${
                          lang.code === locale
                            ? 'bg-cyan-50 text-cyan-700'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </button>
                    ))}
                  </div>

                  <a
                    href="https://panel.innexar.app"
                    className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-50"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('portal')}
                  </a>

                  <a
                    href={portalNewProjectUrl}
                    className="mt-2 block rounded-lg bg-linear-to-r from-cyan-500 to-blue-600 px-4 py-3 text-center text-base font-semibold text-white shadow-md hover:from-cyan-600 hover:to-blue-700"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('getStarted')}
                  </a>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </nav>
      </div>
    </header>
  )
}

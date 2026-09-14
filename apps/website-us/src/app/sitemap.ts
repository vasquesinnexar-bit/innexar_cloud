import { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://innexar.app'
const locales = ['en', 'pt', 'es']

// Only public, indexable pages
const pages = [
  '',
  'about',
  'services',
  'blockchain',
  'checklist',
  'contact',
  'saas',
  'saas/innexar',
  'saas/structurone',
  'launch',
  'portfolio',
  'paid-traffic',
  'privacy-policy',
  'terms-of-service',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: MetadataRoute.Sitemap = []

  locales.forEach((locale) => {
    pages.forEach((page) => {
      const path = page ? `/${page}` : ''
      routes.push({
        url: `${SITE_URL}/${locale}${path}`,
        lastModified: new Date(),
        changeFrequency: page === '' ? 'weekly' : 'monthly',
        priority: page === '' ? 1.0 : page === 'launch' ? 0.95 : page === 'services' ? 0.9 : page === 'contact' ? 0.9 : 0.8,
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [l, `${SITE_URL}/${l}${path}`])
          ),
        },
      })
    })
  })

  return routes
}


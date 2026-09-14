import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "frame-src 'self' https://crm.innexar.com.br https://www.googletagmanager.com https://www.google.com https://www.google.com.br https://googleads.g.doubleclick.net https://www.facebook.com",
  "form-action 'self' https:",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://challenges.cloudflare.com https://static.cloudflareinsights.com",
  "script-src-elem 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://challenges.cloudflare.com https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://api-crm.innexar.com.br wss://api-crm.innexar.com.br https://crm.innexar.com.br https://www.google-analytics.com https://region1.google-analytics.com https://stats.g.doubleclick.net https://www.googletagmanager.com https://www.google.com https://www.google.com.br https://googleads.g.doubleclick.net https://connect.facebook.net https://graph.facebook.com",
  'upgrade-insecure-requests',
].join('; ')

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone', // Necessário para Docker
  async rewrites() {
    const CRM_ORIGIN = 'https://crm.innexar.com.br';
    return [
      { source: '/crm-embed/widget-sdk/:path*', destination: `${CRM_ORIGIN}/widget-sdk/:path*` },
      { source: '/crm-embed/:path*', destination: `${CRM_ORIGIN}/:path*` },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },
  async redirects() {
    const oldRoutes = [
      'about', 'services', 'contact', 'blockchain', 'saas', 'portfolio',
      'checklist', 'privacy-policy', 'terms-of-service', 'launch', 'paid-traffic', 'promo',
    ]
    const localeRedirects = oldRoutes.map(route => ({
      source: `/${route}`,
      destination: `/en/${route}`,
      permanent: true,
    }))

    return [
      ...localeRedirects,
      { source: '/saas/structurone', destination: '/en/saas/structurone', permanent: true },
      { source: '/saas/innexar', destination: '/en/saas/innexar', permanent: true },
      { source: '/mes', destination: '/en', permanent: true },
      { source: '/month', destination: '/en', permanent: true },
      { source: '/mês', destination: '/pt', permanent: true },
      { source: '/portifolio', destination: '/en/portfolio', permanent: true },
    ]
  },
  async headers() {
    return [
      {
        source: '/:locale/portal/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
        ],
      },
      {
        source: '/:locale/dashboard',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
        ],
      },
      {
        source: '/:locale/launch/dashboard/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
        ],
      },
      {
        source: '/:locale/launch/login',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
        ],
      },
      {
        source: '/:locale/launch/forgot-password',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
        ],
      },
      {
        source: '/:locale/launch/reset-password',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
        ],
      },
      {
        source: '/:locale/launch/verify-email',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
        ],
      },
      {
        source: '/:locale/launch/success',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
        ],
      },
      {
        source: '/:locale/waas/success',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
        ],
      },
      {
        source: '/:locale/paid-traffic/success',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
        ],
      },
      {
        source: '/:locale/launch/checkout',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
        ],
      },
      {
        source: '/:locale/paid-traffic/checkout',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
        ],
      },
      {
        source: '/:locale/templates/preview/:templateId',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
          { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

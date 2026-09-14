import { NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from './src/i18n/routing'

const intlMiddleware = createMiddleware(routing)

const CANONICAL_HOST = 'innexar.app'

export default function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''

  // Redirect www to non-www (permanent)
  if (host.startsWith('www.')) {
    const url = request.nextUrl
    const canonical = `https://${CANONICAL_HOST}${url.pathname}${url.search}`
    return NextResponse.redirect(canonical, 301)
  }

  // Run intl middleware
  const response = intlMiddleware(request)

  // Upgrade 307 temporary locale redirects to 308 permanent
  if (response.status === 307) {
    const location = response.headers.get('location')
    if (location) {
      return NextResponse.redirect(new URL(location, request.url), 308)
    }
  }

  return response
}

export const config = {
  matcher: [
    String.raw`/((?!api|_next|_vercel|.*\..*).*)`
  ]
}
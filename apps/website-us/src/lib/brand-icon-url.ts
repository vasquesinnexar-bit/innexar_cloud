/**
 * Simple Icons removed or renamed several brand icons in recent major versions.
 * cdn.simpleicons.org often 404s for those slugs — use jsDelivr with pinned versions.
 * @see https://www.jsdelivr.com/package/npm/simple-icons
 */
const SI_CURRENT = '16.14.0'

/** Slugs that only exist (or match our asset) in older simple-icons releases */
const SLUG_TO_VERSION: Record<string, string> = {
  amazonaws: '11.15.0',
  microsoftazure: '11.15.0',
  openai: '11.15.0',
}

export function brandIconUrl(slug: string): string {
  const version = SLUG_TO_VERSION[slug] ?? SI_CURRENT
  return `https://cdn.jsdelivr.net/npm/simple-icons@${version}/icons/${slug}.svg`
}

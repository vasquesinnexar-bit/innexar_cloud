import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

const LOCALES = routing.locales as readonly ['en', 'pt', 'es']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const deepMergeMessages = (
  base: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> => {
  const merged: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(override)) {
    const baseValue = merged[key]
    if (isRecord(baseValue) && isRecord(value)) {
      merged[key] = deepMergeMessages(baseValue, value)
      continue
    }
    merged[key] = value
  }
  return merged
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale

  if (!locale || !LOCALES.includes(locale as 'en' | 'pt' | 'es')) {
    locale = routing.defaultLocale
  }

  const defaultMessages = (await import(`../../messages/${routing.defaultLocale}.json`)).default

  if (locale === routing.defaultLocale) {
    return { locale, messages: defaultMessages }
  }

  try {
    const localeMessages = (await import(`../../messages/${locale}.json`)).default
    return {
      locale,
      messages: deepMergeMessages(defaultMessages, localeMessages)
    }
  } catch {
    return { locale: routing.defaultLocale, messages: defaultMessages }
  }
})
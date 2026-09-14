import { generateMetadata as genMeta } from '@/lib/seo'
import PaidTrafficPageClient from '@/components/paid-traffic/PaidTrafficPageClient'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  return genMeta(locale, 'paid-traffic')
}

export default function PaidTrafficPage() {
  return <PaidTrafficPageClient />
}

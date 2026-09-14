import Header from '@/components/Header'
import Footer from '@/components/Footer'
import SaasSelectorHero from '@/components/saas/SaasSelectorHero'
import { generateMetadata as genMeta } from '@/lib/seo'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  return genMeta(locale, 'saas')
}

export default function SaasPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <SaasSelectorHero />
      <Footer />
    </main>
  )
}

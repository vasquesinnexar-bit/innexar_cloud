import Header from '@/components/Header'
import Footer from '@/components/Footer'
import SaasHero from '@/components/saas/SaasHero'
import SaasOverview from '@/components/saas/SaasOverview'
import SaasFeatures from '@/components/saas/SaasFeatures'
import SaasPricing from '@/components/saas/SaasPricing'
import SaasTestimonials from '@/components/saas/SaasTestimonials'
import { generateMetadata as genMeta } from '@/lib/seo'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  return genMeta(locale, 'saas')
}

export default function InnexarSaasPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <SaasHero />
      <SaasOverview />
      <SaasFeatures />
      <SaasPricing />
      <SaasTestimonials />
      <Footer />
    </main>
  )
}


